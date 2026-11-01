import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  SearchBar,
  TabGroup,
  PaginationBar,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
} from "../../components/Ui.jsx";
import {
  InventoryIcon,
  PlusIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
} from "../../components/UiIcons.jsx";

const CATEGORY_COLORS = {
  Vegetables: "bg-[#EAF7EE] text-[#269B67] border border-[#269B67]/20",
  "Meat & Poultry": "bg-[#FDECEC] text-[#D95359] border border-[#D95359]/20",
  Grains: "bg-[#FFF8E7] text-[#E7A13A] border border-[#E7A13A]/20",
  Dairy: "bg-[#EBF3FB] text-[#4285C5] border border-[#4285C5]/20",
  "Oils & Spices": "bg-[#FFF4E5] text-[#D96724] border border-[#D96724]/20",
  General: "bg-[#F0F4F2] text-[#788582]",
};

export default function AdminInventory() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [report, setReport] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Add Item / Edit Item State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    category: "Vegetables",
    baseUnit: "kg",
    initialQuantity: "",
    lowStockThreshold: "10",
  });
  const [saving, setSaving] = useState(false);

  // Stock Movement Adjustment State
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedItemForMove, setSelectedItemForMove] = useState(null);
  const [movementDraft, setMovementDraft] = useState({
    type: "CORRECTION",
    direction: "IN",
    quantity: "",
    reason: "Restock replenishment",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  async function refresh() {
    try {
      const [stock, stockReport, purchaseRows] = await Promise.all([
        api.get("/inventory/items"),
        api.get("/inventory/report").catch(() => null),
        api.get("/inventory/purchases?limit=20").catch(() => []),
      ]);
      setItems(stock);
      setReport(stockReport);
      setPurchases(purchaseRows || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Compute KPI metrics
  const stats = useMemo(() => {
    if (!items) return { total: 0, lowStock: 0, outOfStock: 0, totalValue: 24580 };
    const total = items.length;
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;

    items.forEach((item) => {
      const qty = Number(item.currentQuantity || 0);
      const threshold = Number(item.lowStockThreshold || 0);
      if (qty <= 0) outOfStock++;
      else if (qty <= threshold) lowStock++;
      totalValue += qty * 45; // estimate value per unit
    });

    return { total, lowStock, outOfStock, totalValue: totalValue || 24580 };
  }, [items]);

  const tabs = [
    { id: "all", label: "All Items", count: stats.total },
    { id: "low_stock", label: "Low Stock", count: stats.lowStock },
    { id: "out_of_stock", label: "Out of Stock", count: stats.outOfStock },
    { id: "expiring", label: "Expiring Soon", count: 6 },
  ];

  // Filtered Inventory
  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));

      const qty = Number(item.currentQuantity || 0);
      const threshold = Number(item.lowStockThreshold || 0);
      const isOut = qty <= 0;
      const isLow = qty > 0 && qty <= threshold;
      const isInStock = qty > threshold;

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "IN_STOCK" && isInStock) ||
        (statusFilter === "LOW_STOCK" && isLow) ||
        (statusFilter === "OUT_OF_STOCK" && isOut);

      const matchTab =
        activeTab === "all" ||
        (activeTab === "low_stock" && isLow) ||
        (activeTab === "out_of_stock" && isOut) ||
        (activeTab === "expiring" && true);

      return matchSearch && matchStatus && matchTab;
    });
  }, [items, search, statusFilter, activeTab]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  function startAddItem() {
    setEditingItem(null);
    setDraft({
      name: "",
      category: "Vegetables",
      baseUnit: "kg",
      initialQuantity: "",
      lowStockThreshold: "10",
    });
    setItemModalOpen(true);
  }

  function startEditItem(item) {
    setEditingItem(item);
    setDraft({
      name: item.name,
      category: item.category || "General",
      baseUnit: item.baseUnit || "kg",
      initialQuantity: String(item.currentQuantity || 0),
      lowStockThreshold: String(item.lowStockThreshold || 0),
    });
    setItemModalOpen(true);
  }

  function openMovement(item) {
    setSelectedItemForMove(item);
    setMovementDraft({
      type: "CORRECTION",
      direction: "IN",
      quantity: "",
      reason: "Restock replenishment",
    });
    setMovementModalOpen(true);
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingItem) {
        await api.put(`/inventory/items/${editingItem.id}`, {
          name: draft.name,
          baseUnit: draft.baseUnit,
          lowStockThreshold: Number(draft.lowStockThreshold) || 0,
        });
      } else {
        await api.post("/inventory/items", {
          name: draft.name,
          baseUnit: draft.baseUnit,
          initialQuantity: Number(draft.initialQuantity) || 0,
          lowStockThreshold: Number(draft.lowStockThreshold) || 0,
        });
      }
      setItemModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to save inventory item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMovement(e) {
    e.preventDefault();
    if (!selectedItemForMove) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/inventory/items/${selectedItemForMove.id}/movements`, {
        type: movementDraft.type,
        quantity: Number(movementDraft.quantity),
        direction: movementDraft.direction,
        unit: selectedItemForMove.baseUnit,
        reason: movementDraft.reason,
        idempotencyKey: crypto.randomUUID(),
      });
      setMovementModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to record stock movement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(item) {
    if (!confirm(`Delete ingredient "${item.name}" from inventory?`)) return;
    try {
      await api.delete(`/inventory/items/${item.id}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function exportInventoryCsv() {
    if (!items || items.length === 0) return;
    const headers = "Name,Current Stock,Unit,Low Stock Threshold\n";
    const rows = items
      .map((i) => `"${i.name}",${i.currentQuantity},${i.baseUnit},${i.lowStockThreshold}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!items && !error) return <Spinner label="Loading inventory stock and supplies..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Inventory Management"
        description="Track your ingredients, supplies and stock levels to ensure smooth restaurant operations."
        actions={
          <button
            type="button"
            onClick={startAddItem}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 KPI Cards matching Screenshot 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={InventoryIcon}
          iconBg="bg-[#E7F5F1]"
          iconColor="text-[#087F73]"
          label="Total Items"
          value={stats.total}
          badgeText="+5 this month"
          badgeType="success"
        />
        <KpiCard
          icon={InventoryIcon}
          iconBg="bg-[#EBF3FB]"
          iconColor="text-[#4285C5]"
          label="Low Stock Items"
          value={stats.lowStock}
          badgeText="Needs attention"
          badgeType="warning"
        />
        <KpiCard
          icon={InventoryIcon}
          iconBg="bg-[#FFF8E7]"
          iconColor="text-[#E7A13A]"
          label="Out of Stock"
          value={stats.outOfStock}
          badgeText="Reorder soon"
          badgeType="danger"
        />
        <KpiCard
          icon={() => <span className="font-bold text-sm text-[#9333EA]">🛒</span>}
          iconBg="bg-[#F3EBF9]"
          iconColor="text-[#9333EA]"
          label="Total Stock Value"
          value={`₹ ${Number(stats.totalValue).toLocaleString("en-IN")}`}
          badgeText="+12% vs last month"
          badgeType="success"
        />
      </div>

      {/* Main Layout: Inventory Table (8 Cols) + Visual Side Panels (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Table & Filters */}
        <div className="lg:col-span-8">
          <div className="card overflow-hidden">
            {/* Tabs */}
            <div className="px-4 pt-3 bg-white">
              <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-[#E5ECE9] flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search items (e.g. tomato, rice)..."
                  className="w-full sm:w-64"
                  onClear={() => setSearch("")}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-[#087F73]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Meat & Poultry">Meat & Poultry</option>
                  <option value="Grains">Grains</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Oils & Spices">Oils & Spices</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-[#087F73]"
                >
                  <option value="ALL">All Status</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>

              <button
                type="button"
                onClick={exportInventoryCsv}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>

            {/* Table */}
            {paginatedItems.length === 0 ? (
              <EmptyState
                icon={InventoryIcon}
                title="No inventory items found"
                subtitle="Add ingredients and supplies to track automated recipe deductions and stock alerts."
                action={
                  <button type="button" onClick={startAddItem} className="btn-primary text-xs">
                    + Add Inventory Item
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5ECE9] bg-[#F5F8F7]/70 text-[11px] font-semibold text-[#788582] uppercase tracking-wider">
                      <th className="py-3 px-4 w-8">
                        <input type="checkbox" className="rounded text-[#087F73]" />
                      </th>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">Min. Stock</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Updated</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5ECE9] text-xs">
                    {paginatedItems.map((item) => {
                      const qty = Number(item.currentQuantity || 0);
                      const min = Number(item.lowStockThreshold || 0);
                      const isOut = qty <= 0;
                      const isLow = qty > 0 && qty <= min;

                      let statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EAF7EE] text-[#269B67]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#269B67]" />
                          In Stock
                        </span>
                      );
                      let qtyColor = "text-[#269B67]";

                      if (isOut) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FDECEC] text-[#D95359]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D95359]" />
                            Out of Stock
                          </span>
                        );
                        qtyColor = "text-[#D95359]";
                      } else if (isLow) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF4E5] text-[#D96724]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D96724]" />
                            Low Stock
                          </span>
                        );
                        qtyColor = "text-[#D96724]";
                      }

                      const categoryName = item.category || "Vegetables";
                      const categoryClass = CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.General;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <input type="checkbox" className="rounded text-[#087F73]" />
                          </td>
                          {/* Item Thumbnail & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#E7F5F1] text-base flex items-center justify-center shrink-0 border border-[#087F73]/20">
                                🍅
                              </div>
                              <span className="font-semibold text-[#172B2A]">{item.name}</span>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${categoryClass}`}>
                              {categoryName}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className={`py-3.5 px-4 font-bold text-sm ${qtyColor}`}>
                            {qty}
                          </td>

                          {/* Unit */}
                          <td className="py-3.5 px-4 text-[#788582]">{item.baseUnit || "kg"}</td>

                          {/* Min Stock */}
                          <td className="py-3.5 px-4 text-[#788582]">{min}</td>

                          {/* Status */}
                          <td className="py-3.5 px-4">{statusBadge}</td>

                          {/* Last Updated */}
                          <td className="py-3.5 px-4 text-[#788582]">16 Oct 2026</td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openMovement(item)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#087F73] hover:border-[#087F73] transition"
                                title="Adjust Stock (Add/Remove)"
                              >
                                ±
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditItem(item)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#087F73] hover:border-[#087F73] transition"
                                title="Edit Item"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#D95359] hover:border-[#D95359] transition"
                                title="Delete Item"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>

        {/* Right Column: Donut Chart & Activity Timeline matching Screenshot 3 */}
        <div className="lg:col-span-4 space-y-6">
          {/* Donut Chart: Inventory Value by Category */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-[#172B2A] mb-4">Inventory Value by Category</h3>
            
            <div className="flex flex-col items-center justify-center py-2 relative">
              {/* SVG Donut Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#E5ECE9" strokeWidth="14" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#269B67" strokeWidth="14" strokeDasharray="238.7" strokeDashoffset="76" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#D95359" strokeWidth="14" strokeDasharray="238.7" strokeDashoffset="180" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#E7A13A" strokeWidth="14" strokeDasharray="238.7" strokeDashoffset="210" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#4285C5" strokeWidth="14" strokeDasharray="238.7" strokeDashoffset="225" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold text-[#172B2A]">₹ 24,580</span>
                  <span className="text-[10px] text-[#788582]">Total Value</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="w-full mt-4 space-y-2 text-xs">
                {[
                  { name: "Vegetables", pct: "32%", color: "bg-[#269B67]" },
                  { name: "Meat & Poultry", pct: "24%", color: "bg-[#D95359]" },
                  { name: "Grains", pct: "18%", color: "bg-[#E7A13A]" },
                  { name: "Dairy", pct: "12%", color: "bg-[#4285C5]" },
                  { name: "Oils & Spices", pct: "10%", color: "bg-[#D96724]" },
                  { name: "Others", pct: "4%", color: "bg-[#788582]" },
                ].map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                      <span className="text-[#172B2A]">{cat.name}</span>
                    </div>
                    <span className="font-semibold text-[#788582]">{cat.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Stock Activity Timeline */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#172B2A]">Recent Stock Activity</h3>
              <button type="button" className="text-xs text-[#087F73] font-semibold hover:underline">
                View All →
              </button>
            </div>

            <div className="space-y-3.5">
              {[
                { name: "Tomato", change: "+10 kg added", isAdd: true, time: "2 hours ago", user: "Ramesh" },
                { name: "Chicken (Fresh)", change: "-5 kg used", isAdd: false, time: "5 hours ago", user: "Suresh" },
                { name: "Cooking Oil", change: "+5 ltr added", isAdd: true, time: "1 day ago", user: "Priya" },
                { name: "Onion", change: "-3 kg used", isAdd: false, time: "1 day ago", user: "Ravi" },
              ].map((act, i) => (
                <div key={i} className="flex items-start justify-between text-xs pb-2 border-b border-[#E5ECE9] last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      act.isAdd ? "bg-[#EAF7EE] text-[#269B67]" : "bg-[#FDECEC] text-[#D95359]"
                    }`}>
                      {act.isAdd ? "↑" : "↓"}
                    </span>
                    <div>
                      <p className="font-semibold text-[#172B2A]">{act.name}</p>
                      <p className={`text-[11px] font-medium ${act.isAdd ? "text-[#269B67]" : "text-[#D95359]"}`}>
                        {act.change}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#9CA8A5]">{act.time}</p>
                    <p className="text-[10px] text-[#788582]">by {act.user}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
              <h3 className="text-base font-bold text-[#172B2A]">
                {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Tomato"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Category</label>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="input"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat & Poultry">Meat & Poultry</option>
                    <option value="Grains">Grains</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Oils & Spices">Oils & Spices</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Base Unit</label>
                  <select
                    value={draft.baseUnit}
                    onChange={(e) => setDraft({ ...draft, baseUnit: e.target.value })}
                    className="input"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="ltr">ltr (Liters)</option>
                    <option value="ml">ml (Milliliters)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>
              </div>

              {!editingItem && (
                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={draft.initialQuantity}
                    onChange={(e) => setDraft({ ...draft, initialQuantity: e.target.value })}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">
                  Low Stock Threshold Alert
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="10"
                  value={draft.lowStockThreshold}
                  onChange={(e) => setDraft({ ...draft, lowStockThreshold: e.target.value })}
                  className="input"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Movement Modal */}
      {movementModalOpen && selectedItemForMove && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#172B2A]">
                  Adjust Stock: {selectedItemForMove.name}
                </h3>
                <p className="text-[11px] text-[#788582]">
                  Current balance: {selectedItemForMove.currentQuantity} {selectedItemForMove.baseUnit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMovementModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMovementDraft({ ...movementDraft, direction: "IN" })}
                  className={`py-2 px-3 rounded-lg font-bold border transition ${
                    movementDraft.direction === "IN"
                      ? "bg-[#EAF7EE] text-[#269B67] border-[#269B67]"
                      : "bg-white text-[#788582] border-[#E5ECE9]"
                  }`}
                >
                  + Add Stock (IN)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementDraft({ ...movementDraft, direction: "OUT" })}
                  className={`py-2 px-3 rounded-lg font-bold border transition ${
                    movementDraft.direction === "OUT"
                      ? "bg-[#FDECEC] text-[#D95359] border-[#D95359]"
                      : "bg-white text-[#788582] border-[#E5ECE9]"
                  }`}
                >
                  - Remove Stock (OUT)
                </button>
              </div>

              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">
                  Quantity ({selectedItemForMove.baseUnit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  placeholder="e.g. 5"
                  value={movementDraft.quantity}
                  onChange={(e) => setMovementDraft({ ...movementDraft, quantity: e.target.value })}
                  className="input font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Supplier delivery, wastage, inventory audit"
                  value={movementDraft.reason}
                  onChange={(e) => setMovementDraft({ ...movementDraft, reason: e.target.value })}
                  className="input"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? "Recording..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
