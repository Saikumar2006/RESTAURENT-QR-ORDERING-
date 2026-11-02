import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  TabGroup,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
} from "../../components/Ui.jsx";
import {
  TablesIcon,
  PlusIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "../../components/UiIcons.jsx";

export default function AdminTables() {
  const { user } = useAuth();
  const [tables, setTables] = useState(null);
  const [menu, setMenu] = useState([]);
  const [activeOrders, setActiveOrders] = useState({});
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");
  const [newSection, setNewSection] = useState("Main Dining");
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("floor"); // "floor" | "list" | "qr"
  const [selectedTable, setSelectedTable] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [savingTable, setSavingTable] = useState(false);

  // Add Items Modal
  const [addItemsTable, setAddItemsTable] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);

  // QR Modal
  const [qrData, setQrData] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  async function refresh(targetTableNumber = null) {
    try {
      const [tableData, menuData] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/tables`),
        api.get(`/restaurants/${user.restaurantId}/menu`),
      ]);

      setTables(tableData);
      setMenu(menuData);

      const activeOrderMap = {};
      for (const table of tableData) {
        try {
          activeOrderMap[table.id] = await api.get(`/tables/${table.id}/active-order`);
        } catch (err) {
          if (err.status === 404) {
            activeOrderMap[table.id] = null;
          } else {
            console.error(err);
          }
        }
      }
      setActiveOrders(activeOrderMap);

      if (targetTableNumber) {
        const found = tableData.find((t) => t.tableNumber === targetTableNumber);
        if (found) setSelectedTable(found);
      } else if (!selectedTable && tableData.length > 0) {
        setSelectedTable(tableData[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load restaurant tables");
    }
  }

  useEffect(() => {
    if (user?.restaurantId) refresh();
  }, [user?.restaurantId]);

  // Compute table statistics
  const stats = useMemo(() => {
    if (!tables) return { total: 0, available: 0, occupied: 0, maintenance: 0 };
    const total = tables.length;
    let occupied = 0;
    let maintenance = 0;

    tables.forEach((t) => {
      if (!t.isActive) maintenance++;
      else if (activeOrders[t.id]) occupied++;
    });

    const available = total - occupied - maintenance;
    return { total, available: Math.max(0, available), occupied, maintenance };
  }, [tables, activeOrders]);

  const tabs = [
    { id: "floor", label: "Floor Plan View" },
    { id: "list", label: "Table List View" },
    { id: "qr", label: "Restaurant QR Code" },
  ];

  async function handleAddTable(e) {
    if (e?.preventDefault) e.preventDefault();
    const cleanNumber = newTableNumber.trim();
    if (!cleanNumber) {
      setError("Please enter a table number or label (e.g. 12, T-15, Patio-1)");
      return;
    }

    setSavingTable(true);
    setError(null);
    try {
      // Send sanitized tableNumber to match Prisma schema
      await api.post(`/restaurants/${user.restaurantId}/tables`, {
        tableNumber: cleanNumber,
      });

      setSuccessMsg(`Table ${cleanNumber} created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setNewTableNumber("");
      setAddModalOpen(false);
      await refresh(cleanNumber);
    } catch (err) {
      setError(err.message || "Failed to create table. Please check if it already exists.");
    } finally {
      setSavingTable(false);
    }
  }

  async function toggleTable(table) {
    try {
      if (table.isActive) {
        await api.delete(`/tables/${table.id}`);
      } else {
        await api.put(`/tables/${table.id}`, { isActive: true });
      }
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function openAddItems(table) {
    setAddItemsTable(table);
    setDraftItems([]);
  }

  function toggleDraftItem(item) {
    setDraftItems((prev) => {
      if (prev.some((entry) => entry.menuItemId === item.id)) {
        return prev.filter((entry) => entry.menuItemId !== item.id);
      }
      return [...prev, { menuItemId: item.id, quantity: 1, instructions: "" }];
    });
  }

  function updateDraftQuantity(menuItemId, quantity) {
    setDraftItems((prev) =>
      prev.map((entry) =>
        entry.menuItemId === menuItemId
          ? { ...entry, quantity: Math.max(1, Number(quantity) || 1) }
          : entry
      )
    );
  }

  async function submitAddItems(e) {
    e.preventDefault();
    if (!addItemsTable || draftItems.length === 0) return;
    setSavingItems(true);
    try {
      await api.post(`/tables/${addItemsTable.id}/active-order/items`, { items: draftItems });
      setAddItemsTable(null);
      setDraftItems([]);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItems(false);
    }
  }

  async function openQr() {
    setQrOpen(true);
    if (qrData) return;
    setQrLoading(true);
    try {
      const data = await api.get(`/restaurants/${user.restaurantId}/qr`);
      setQrData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setQrLoading(false);
    }
  }

  const allMenuItems = menu.flatMap((category) => category.menuItems || []);

  if (!tables && !error) return <Spinner label="Loading table seating and floor plan..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Table Management"
        description="Monitor table occupancy, configure dining sections, take direct orders, and print digital QR codes."
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={openQr}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>📱 View Restaurant QR</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAddModalOpen(true);
              }}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span>+ Add Table</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3 flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold">✓</span>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-800 font-bold ml-2 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 KPI Cards - Modern Blue & Purple Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Tables"
          value={stats.total}
          badgeText="Active dining room"
          badgeType="purple"
        />
        <KpiCard
          icon={CheckIcon}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Available Tables"
          value={stats.available}
          badgeText="Ready for seating"
          badgeType="success"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          label="Occupied Tables"
          value={stats.occupied}
          badgeText="Dining in progress"
          badgeType="danger"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
          label="Under Maintenance"
          value={stats.maintenance}
          badgeText="Disabled seating"
          badgeType="neutral"
        />
      </div>

      {/* View Switcher Tabs */}
      <div className="card px-5 pt-3.5">
        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: Interactive Floor Plan View */}
      {activeTab === "floor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Floor Plan Canvas (8 Cols) */}
          <div className="lg:col-span-8 card p-6 bg-slate-50/70 border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Main Dining Hall Floor Plan</h3>
                <p className="text-xs text-slate-500">Click any table to view live order tickets or add items.</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" /> Available
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-rose-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" /> Occupied
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Disabled
                </span>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="ml-2 text-indigo-600 font-bold hover:text-indigo-800 text-xs flex items-center gap-1"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Visual Floor Grid */}
            {tables.length === 0 ? (
              <EmptyState
                icon={TablesIcon}
                title="No tables created yet"
                subtitle="Get started by creating your first dining table with a table number."
                action={
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Create Your First Table</span>
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-5 rounded-2xl border border-dashed border-slate-300 bg-white min-h-[380px]">
                {tables.map((table) => {
                  const activeOrder = activeOrders[table.id];
                  const isSelected = selectedTable?.id === table.id;
                  const isOccupied = table.isActive && Boolean(activeOrder);
                  const isAvailable = table.isActive && !activeOrder;

                  let borderClass = "border-slate-200";
                  let bgClass = "bg-slate-50/60";

                  if (isOccupied) {
                    borderClass = "border-rose-300 shadow-xs";
                    bgClass = "bg-rose-50/50";
                  } else if (isAvailable) {
                    borderClass = "border-emerald-200 shadow-2xs";
                    bgClass = "bg-emerald-50/40";
                  }

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTable(table)}
                      className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-between min-h-[125px] ${borderClass} ${bgClass} ${
                        isSelected
                          ? "ring-2 ring-indigo-600 border-indigo-600 shadow-glow scale-[1.02]"
                          : "hover:border-indigo-400 hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full text-[10px] font-bold">
                        <span className="text-slate-400">Cap: 4</span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shadow-2xs ${
                            isOccupied
                              ? "bg-rose-500"
                              : isAvailable
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`}
                        />
                      </div>

                      <div className="my-1.5">
                        <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                          T-{table.tableNumber}
                        </span>
                      </div>

                      <div className="w-full">
                        {isOccupied ? (
                          <div className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md truncate">
                            ₹{Number(activeOrder.totalAmount || 0).toFixed(0)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            {isAvailable ? "Available" : "Disabled"}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table Details Side Panel (4 Cols) */}
          <div className="lg:col-span-4 card p-6 sticky top-20 border-slate-200">
            {selectedTable ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Table {selectedTable.tableNumber} Details
                    </h3>
                    <p className="text-xs text-slate-500">Capacity: 4 Guests · Main Dining</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTable(selectedTable)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {selectedTable.isActive ? "Disable Table" : "Enable Table"}
                  </button>
                </div>

                {/* Active Order Card */}
                {activeOrders[selectedTable.id] ? (
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800">Dining in Progress</span>
                      <span className="text-xs font-bold text-slate-900">
                        ₹ {Number(activeOrders[selectedTable.id].totalAmount || 0).toFixed(0)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-900">
                      <p className="font-semibold text-[11px] text-slate-500">
                        Order #{activeOrders[selectedTable.id].orderNumber}
                      </p>
                      <div className="divide-y divide-slate-200/80 max-h-36 overflow-y-auto pr-1">
                        {(activeOrders[selectedTable.id].items || []).map((item, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span>{item.quantity}x {item.menuItem?.name || "Dish"}</span>
                            <span className="font-semibold">₹{Number(item.price || 0) * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAddItems(selectedTable)}
                      className="btn-primary w-full text-xs py-2 shadow-xs"
                    >
                      + Add Dishes to Table
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-800">Table is currently available</p>
                    <p className="text-[11px] text-slate-500">
                      When customers scan the QR code and order from Table {selectedTable.tableNumber}, their ticket will appear here in real-time.
                    </p>
                  </div>
                )}

                {/* QR Shortcut */}
                <div className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <span>📱</span>
                    <span className="font-semibold text-slate-800">Restaurant QR Code</span>
                  </div>
                  <button
                    type="button"
                    onClick={openQr}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    View QR →
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center py-10 text-xs text-slate-500">
                Select a table on the floor plan to inspect status.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Table List View */}
      {activeTab === "list" && (
        <div className="card overflow-hidden border-slate-200">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">All Tables Directory</h3>
              <p className="text-xs text-slate-500">Overview of all dining spaces and occupancy status.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Table</span>
            </button>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Table Number</th>
                <th className="py-3 px-4">Seating Capacity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Ticket</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tables.map((table) => {
                const active = activeOrders[table.id];
                return (
                  <tr key={table.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">Table {table.tableNumber}</td>
                    <td className="py-3.5 px-4 text-slate-500">4 Guests</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        table.isActive
                          ? active
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {table.isActive ? (active ? "Occupied" : "Available") : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {active ? (
                        <span className="font-semibold text-slate-900">
                          #{active.orderNumber} (₹{Number(active.totalAmount).toFixed(0)})
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {active && (
                        <button
                          type="button"
                          onClick={() => openAddItems(table)}
                          className="btn-secondary py-1 px-2.5 text-xs"
                        >
                          Add Items
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleTable(table)}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        {table.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: QR Code Downloader */}
      {activeTab === "qr" && (
        <div className="card p-8 max-w-xl mx-auto text-center space-y-4 border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
            📱
          </div>
          <h3 className="text-lg font-bold text-slate-900">Unified Restaurant QR Code</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            One QR code for your entire restaurant. Print and place this on tables and the payment counter.
            Guests scan to view the live menu, select their table, and order directly.
          </p>

          <button
            type="button"
            onClick={openQr}
            className="btn-primary text-xs mx-auto flex items-center gap-2 shadow-xs"
          >
            <span>Open & Print Official QR Code</span>
          </button>
        </div>
      )}

      {/* ADD TABLE MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  +
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Dining Table</h3>
                  <p className="text-xs text-slate-500">Configure a new seating station for your restaurant.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Table Number / Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12, T-15, Patio-2"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  autoFocus
                  required
                  className="input py-2 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">This identifier appears on KOT slips and QR scans.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Seating Capacity
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["2", "4", "6", "8"].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewCapacity(cap)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        newCapacity === cap
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {cap} Guests
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Dining Section
                </label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="input py-2 text-xs"
                >
                  <option value="Main Dining">Main Dining Hall</option>
                  <option value="Patio">Outdoor Patio</option>
                  <option value="Balcony">Rooftop / Balcony</option>
                  <option value="Bar">Bar & Lounge</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTable || !newTableNumber.trim()}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-sm"
                >
                  {savingTable ? (
                    <span>Creating Table...</span>
                  ) : (
                    <>
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>Save Table</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {addItemsTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Add Dishes to Table {addItemsTable.tableNumber}
                </h3>
                <p className="text-[11px] text-slate-500">Select dishes to append to the active order.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddItemsTable(null)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitAddItems} className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              {allMenuItems.map((item) => {
                const selected = draftItems.find((d) => d.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between ${
                      selected ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-slate-500">₹{item.price}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selected ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(item.id, selected.quantity - 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-slate-900">{selected.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(item.id, selected.quantity + 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleDraftItem(item)}
                          className="btn-secondary py-1 px-3 text-xs"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddItemsTable(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItems || draftItems.length === 0}
                  className="btn-primary text-xs"
                >
                  {savingItems ? "Saving..." : `Add ${draftItems.length} Dishes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Restaurant Dine-In QR</h3>
            {qrLoading ? (
              <Spinner label="Generating high-resolution QR..." />
            ) : qrData ? (
              <div className="space-y-3">
                <img
                  src={qrData.qrCode}
                  alt="Restaurant QR Code"
                  className="w-56 h-56 mx-auto border border-slate-200 rounded-xl p-2 bg-white shadow-xs"
                />
                <p className="text-xs text-slate-500 truncate">{qrData.url}</p>
                <div className="flex gap-2 justify-center pt-2">
                  <a
                    href={qrData.qrCode}
                    download="svaadya-restaurant-qr.png"
                    className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Download QR</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-secondary text-xs"
                  >
                    Print
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-600">Failed to load QR code</p>
            )}

            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="text-xs text-slate-500 font-semibold hover:text-slate-800 pt-2 block mx-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
