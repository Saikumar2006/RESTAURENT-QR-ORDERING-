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
  DownloadIcon,
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
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("floor"); // "floor" | "list" | "qr"
  const [selectedTable, setSelectedTable] = useState(null);

  // Add Items Modal
  const [addItemsTable, setAddItemsTable] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);

  // QR Modal
  const [qrData, setQrData] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  async function refresh() {
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
      if (!selectedTable && tableData.length > 0) {
        setSelectedTable(tableData[0]);
      }
    } catch (err) {
      setError(err.message);
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

  async function addTable(e) {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    try {
      await api.post(`/restaurants/${user.restaurantId}/tables`, {
        tableNumber: newTableNumber.trim(),
        capacity: Number(newCapacity) || 4,
      });
      setNewTableNumber("");
      refresh();
    } catch (err) {
      setError(err.message);
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
        description="Monitor table occupancy, add seating sections, take direct orders, and print your digital QR codes."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openQr}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>View Restaurant QR</span>
            </button>
            <form onSubmit={addTable} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Table No. (e.g. 12)"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                className="input py-1.5 px-3 w-36 text-xs"
              />
              <button type="submit" className="btn-primary text-xs flex items-center gap-1">
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Add Table</span>
              </button>
            </form>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-[#E7F5F1]"
          iconColor="text-[#087F73]"
          label="Total Tables"
          value={stats.total}
          badgeText="Active dining room"
          badgeType="neutral"
        />
        <KpiCard
          icon={CheckIcon}
          iconBg="bg-[#EAF7EE]"
          iconColor="text-[#269B67]"
          label="Available Tables"
          value={stats.available}
          badgeText="Ready for seating"
          badgeType="success"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-[#FDECEC]"
          iconColor="text-[#D95359]"
          label="Occupied Tables"
          value={stats.occupied}
          badgeText="Dining in progress"
          badgeType="danger"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-[#F0F4F2]"
          iconColor="text-[#788582]"
          label="Under Maintenance"
          value={stats.maintenance}
          badgeText="Disabled seating"
          badgeType="neutral"
        />
      </div>

      {/* View Switcher Tabs */}
      <div className="card px-4 pt-3">
        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: Interactive Floor Plan View */}
      {activeTab === "floor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Floor Plan Canvas (8 Cols) */}
          <div className="lg:col-span-8 card p-6 bg-[#F8FAF9]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5ECE9] mb-6">
              <div>
                <h3 className="text-sm font-bold text-[#172B2A]">Main Dining Hall Floor Plan</h3>
                <p className="text-xs text-[#788582]">Click any table to view live order tickets or add items.</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#269B67]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#269B67]" /> Available
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#D95359]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D95359]" /> Occupied
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#9CA8A5]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9CA8A5]" /> Disabled
                </span>
              </div>
            </div>

            {/* Visual Floor Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 rounded-xl border border-dashed border-[#D1DCD6] bg-white min-h-[380px]">
              {tables.map((table) => {
                const activeOrder = activeOrders[table.id];
                const isSelected = selectedTable?.id === table.id;
                const isOccupied = table.isActive && Boolean(activeOrder);
                const isAvailable = table.isActive && !activeOrder;

                let borderClass = "border-[#E5ECE9]";
                let bgClass = "bg-[#F8FAF9]";
                let textClass = "text-[#788582]";

                if (isOccupied) {
                  borderClass = "border-[#D95359] shadow-sm";
                  bgClass = "bg-[#FDECEC]/40";
                  textClass = "text-[#D95359]";
                } else if (isAvailable) {
                  borderClass = "border-[#269B67]/40 shadow-xs";
                  bgClass = "bg-[#EAF7EE]/30";
                  textClass = "text-[#269B67]";
                }

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => setSelectedTable(table)}
                    className={`p-4 rounded-2xl border-2 transition text-center flex flex-col items-center justify-between min-h-[120px] ${borderClass} ${bgClass} ${
                      isSelected ? "ring-2 ring-[#087F73] scale-102" : "hover:border-[#087F73]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full text-[10px] font-bold">
                      <span className="text-[#9CA8A5]">Cap: 4</span>
                      <span className={`w-2 h-2 rounded-full ${isOccupied ? "bg-[#D95359]" : isAvailable ? "bg-[#269B67]" : "bg-[#9CA8A5]"}`} />
                    </div>

                    <div className="my-1">
                      <span className="text-xl font-extrabold text-[#172B2A]">
                        T-{table.tableNumber}
                      </span>
                    </div>

                    <div className="w-full">
                      {isOccupied ? (
                        <div className="text-[10px] font-bold text-[#D95359] bg-[#FDECEC] px-1.5 py-0.5 rounded truncate">
                          ₹{Number(activeOrder.totalAmount || 0).toFixed(0)}
                        </div>
                      ) : (
                        <div className="text-[10px] font-semibold text-[#269B67] bg-[#EAF7EE] px-1.5 py-0.5 rounded">
                          {isAvailable ? "Available" : "Disabled"}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Details Side Panel (4 Cols) */}
          <div className="lg:col-span-4 card p-5 sticky top-20">
            {selectedTable ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9]">
                  <div>
                    <h3 className="text-base font-bold text-[#172B2A]">
                      Table {selectedTable.tableNumber} Details
                    </h3>
                    <p className="text-xs text-[#788582]">Capacity: 4 Guests · Main Dining</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTable(selectedTable)}
                    className="text-xs font-semibold text-[#087F73] hover:underline"
                  >
                    {selectedTable.isActive ? "Disable Table" : "Enable Table"}
                  </button>
                </div>

                {/* Active Order Card */}
                {activeOrders[selectedTable.id] ? (
                  <div className="p-4 rounded-xl bg-[#EAF7EE]/50 border border-[#269B67]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#269B67]">Dining in Progress</span>
                      <span className="text-xs font-bold text-[#172B2A]">
                        ₹ {Number(activeOrders[selectedTable.id].totalAmount || 0).toFixed(0)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#172B2A]">
                      <p className="font-semibold text-[11px] text-[#788582]">
                        Order #{activeOrders[selectedTable.id].orderNumber}
                      </p>
                      <div className="divide-y divide-[#E5ECE9]/60 max-h-36 overflow-y-auto">
                        {(activeOrders[selectedTable.id].items || []).map((item, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span>{item.quantity}x {item.menuItem?.name || "Dish"}</span>
                            <span>₹{Number(item.price || 0) * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAddItems(selectedTable)}
                      className="btn-primary w-full text-xs py-2"
                    >
                      + Add Dishes to Table
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9] text-center space-y-2">
                    <p className="text-xs font-bold text-[#172B2A]">Table is currently empty</p>
                    <p className="text-[11px] text-[#788582]">
                      When customers scan the QR code and order from Table {selectedTable.tableNumber}, their ticket will appear here in real-time.
                    </p>
                  </div>
                )}

                {/* QR Shortcut */}
                <div className="p-3.5 rounded-xl border border-[#E5ECE9] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>📱</span>
                    <span className="font-semibold text-[#172B2A]">Restaurant QR Code</span>
                  </div>
                  <button
                    type="button"
                    onClick={openQr}
                    className="text-[#087F73] font-bold hover:underline"
                  >
                    View QR →
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center py-10 text-xs text-[#788582]">
                Select a table on the floor plan to inspect status.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Table List View */}
      {activeTab === "list" && (
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE9] bg-[#F5F8F7] text-[11px] font-semibold text-[#788582] uppercase">
                <th className="py-3 px-4">Table Number</th>
                <th className="py-3 px-4">Seating Capacity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Ticket</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5ECE9]">
              {tables.map((table) => {
                const active = activeOrders[table.id];
                return (
                  <tr key={table.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-[#172B2A]">Table {table.tableNumber}</td>
                    <td className="py-3.5 px-4 text-[#788582]">4 Guests</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        table.isActive
                          ? active
                            ? "bg-[#FDECEC] text-[#D95359]"
                            : "bg-[#EAF7EE] text-[#269B67]"
                          : "bg-[#F0F4F2] text-[#788582]"
                      }`}>
                        {table.isActive ? (active ? "Occupied" : "Available") : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {active ? (
                        <span className="font-semibold text-[#172B2A]">
                          #{active.orderNumber} (₹{Number(active.totalAmount).toFixed(0)})
                        </span>
                      ) : (
                        <span className="text-[#9CA8A5]">—</span>
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
                        className="text-xs text-[#087F73] font-semibold hover:underline"
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
        <div className="card p-8 max-w-xl mx-auto text-center space-y-4">
          <h3 className="text-lg font-bold text-[#172B2A]">Your Unified Restaurant QR Code</h3>
          <p className="text-xs text-[#788582]">
            One QR code for your entire restaurant. Print and place this on tables and the payment counter.
            Guests scan to view the live menu, select their table, and order directly.
          </p>

          <button
            type="button"
            onClick={openQr}
            className="btn-primary text-xs mx-auto flex items-center gap-2"
          >
            <span>Open & Print Official QR Code</span>
          </button>
        </div>
      )}

      {/* Add Items Modal */}
      {addItemsTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-[#E5ECE9] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172B2A]">
                  Add Dishes to Table {addItemsTable.tableNumber}
                </h3>
                <p className="text-[11px] text-[#788582]">Select dishes to append to the active order.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddItemsTable(null)}
                className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582]"
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
                      selected ? "border-[#087F73] bg-[#E7F5F1]/30" : "border-[#E5ECE9] bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-[#172B2A]">{item.name}</p>
                      <p className="text-[#788582]">₹{item.price}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selected ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={selected.quantity}
                            onChange={(e) => updateDraftQuantity(item.id, e.target.value)}
                            className="input w-16 text-center py-1 font-bold text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => toggleDraftItem(item)}
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleDraftItem(item)}
                          className="btn-secondary py-1 px-3 text-xs"
                        >
                          + Select
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5ECE9]">
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
                  {savingItems ? "Adding..." : `Append ${draftItems.length} Dishes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-sm w-full p-6 text-center shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#172B2A]">Restaurant Dine-In QR</h3>
            {qrLoading ? (
              <Spinner label="Generating high-resolution QR..." />
            ) : qrData ? (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-[#E5ECE9] rounded-xl inline-block shadow-inner">
                  <img src={qrData.qrDataUrl} alt="Restaurant QR" className="w-56 h-56 mx-auto" />
                </div>
                <p className="text-xs text-[#788582] truncate">{qrData.url}</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-primary w-full text-xs"
                >
                  Print QR Code
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#D95359]">Failed to load QR code.</p>
            )}
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="btn-secondary w-full text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
