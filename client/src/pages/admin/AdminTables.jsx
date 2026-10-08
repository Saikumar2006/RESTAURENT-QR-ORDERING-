import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

export default function AdminTables() {
  const { user } = useAuth();
  const [tables, setTables] = useState(null);
  const [menu, setMenu] = useState([]);
  const [activeOrders, setActiveOrders] = useState({});
  const [newTableNumber, setNewTableNumber] = useState("");
  const [error, setError] = useState(null);
  const [addItemsTable, setAddItemsTable] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);

  // The whole restaurant now shares ONE QR code — printed once and put on
  // every table / at the counter. Customers pick their table (or takeaway)
  // after scanning it, so there's no per-table QR to generate anymore.
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
            throw err;
          }
        }
      }
      setActiveOrders(activeOrderMap);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (user?.restaurantId) refresh();
  }, [user?.restaurantId]);

  async function addTable(e) {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    try {
      await api.post(`/restaurants/${user.restaurantId}/tables`, { tableNumber: newTableNumber });
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
    setDraftItems((prev) => prev.map((entry) => (
      entry.menuItemId === menuItemId ? { ...entry, quantity: Math.max(1, Number(quantity) || 1) } : entry
    )));
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

  if (!tables) return <Spinner label="Loading tables..." />;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="font-display text-3xl mb-2">Tables</h1>
      <p className="text-sm text-charcoal/50 mb-6">
        Add every table you have so customers can select one after scanning your single restaurant QR code.
      </p>
      {error && <ErrorBanner message={error} />}

      <div className="card p-5 mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold mb-1">Your restaurant's QR code</h2>
          <p className="text-sm text-charcoal/50">
            One QR for the whole restaurant — print it once and place it on every table or at the counter.
            Customers choose "Dine In" (and their table) or "Takeaway" after scanning.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={openQr}>
          View QR
        </button>
      </div>

      <form onSubmit={addTable} className="flex gap-2 mb-8">
        <input className="input" placeholder="Table number (e.g. 6)" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} />
        <button className="btn-primary shrink-0" type="submit">Add Table</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tables.map((t) => {
          const activeOrder = activeOrders[t.id];
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-display text-lg">Table {t.tableNumber}</p>
                <span className={`text-xs font-semibold ${t.isActive ? "text-sage" : "text-charcoal/30"}`}>
                  {t.isActive ? "Active" : "Disabled"}
                </span>
              </div>

              {activeOrder ? (
                <div className="space-y-2 mb-3 rounded border border-sage/20 bg-sage/5 p-3 text-sm">
                  <p className="font-semibold text-charcoal">Active order</p>
                  <p className="text-charcoal/65">{activeOrder.items?.length || 0} items · ₹{Number(activeOrder.totalAmount || 0).toFixed(0)}</p>
                  <p className="text-[11px] text-charcoal/60">{activeOrder.orderNumber} · {activeOrder.status}</p>
                </div>
              ) : (
                <div className="mb-3 rounded border border-charcoal/10 bg-charcoal/3 p-3 text-sm text-charcoal/55">
                  No active order for this table
                </div>
              )}

              <div className="flex gap-2">
                <button className="btn-secondary flex-1 py-1.5 text-xs" onClick={() => toggleTable(t)}>
                  {t.isActive ? "Disable" : "Enable"}
                </button>
                {activeOrder && (
                  <button className="btn-primary flex-1 py-1.5 text-xs" onClick={() => openAddItems(t)}>
                    Add Items
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addItemsTable && (
        <div className="fixed inset-0 bg-charcoal/45 flex items-center justify-center p-4 z-30" onClick={() => setAddItemsTable(null)}>
          <div className="card w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-charcoal/10 p-4 flex items-center justify-between">
              <div>
                <p className="section-eyebrow !ml-0">Add items</p>
                <h3 className="font-display text-2xl">Table {addItemsTable.tableNumber}</h3>
              </div>
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setAddItemsTable(null)}>
                Close
              </button>
            </div>
            <form onSubmit={submitAddItems} className="p-4 overflow-y-auto max-h-[65vh]">
              <div className="space-y-2">
                {allMenuItems.map((item) => {
                  const selected = draftItems.find((entry) => entry.menuItemId === item.id);
                  return (
                    <div key={item.id} className="rounded border border-charcoal/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-charcoal/50">₹{Number(item.price).toFixed(0)}</p>
                        </div>
                        <button type="button" className={selected ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"} onClick={() => toggleDraftItem(item)}>
                          {selected ? "Selected" : "Add"}
                        </button>
                      </div>
                      {selected && (
                        <div className="mt-3 flex items-center gap-2">
                          <label className="text-xs text-charcoal/60">Qty</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={selected.quantity}
                            onChange={(event) => updateDraftQuantity(item.id, event.target.value)}
                            className="input max-w-[90px]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setAddItemsTable(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingItems || draftItems.length === 0}>
                  {savingItems ? "Adding..." : "Add to Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center p-6 z-20" onClick={() => setQrOpen(false)}>
          <div className="card p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl mb-1">Restaurant QR</h3>
            {qrLoading || !qrData ? (
              <Spinner label="Generating QR..." />
            ) : (
              <>
                <img src={qrData.dataUrl} alt="Restaurant QR code" className="mx-auto my-4 w-56 h-56" />
                <p className="text-xs text-charcoal/40 mb-4 break-all">{qrData.url}</p>
                <a href={qrData.dataUrl} download="restaurant-qr.png" className="btn-primary w-full block">
                  Download QR
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
