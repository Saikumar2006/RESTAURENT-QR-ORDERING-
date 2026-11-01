import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import {
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
  StatusPill,
  SearchBar,
} from "../../components/Ui.jsx";
import {
  OrdersIcon,
  PlusIcon,
  CheckIcon,
} from "../../components/UiIcons.jsx";

const NEXT_STATUS = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
};

export default function AdminOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("orderId"));
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMenu, setManualMenu] = useState([]);
  const [manualTables, setManualTables] = useState([]);
  const [manualType, setManualType] = useState("TAKEAWAY");
  const [manualTableId, setManualTableId] = useState("");
  const [manualItems, setManualItems] = useState({});
  const [manualSaving, setManualSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get(`/restaurants/${user.restaurantId}/orders`, {
        params: {
          page: 1,
          pageSize: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(sourceFilter ? { source: sourceFilter } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(fromDate ? { from: new Date(`${fromDate}T00:00:00`).toISOString() } : {}),
          ...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}),
        },
      });
      setOrders(data);
      setPage(1);
      setHasMore(data.length === 100);
    } catch (err) {
      setError(err.message);
    }
    try {
      setInsights(await api.get(`/restaurants/${user.restaurantId}/analytics`, { params: { days: 7 } }));
    } catch {
      setInsights(null);
    }
  }, [user.restaurantId, statusFilter, sourceFilter, fromDate, toDate, search]);

  async function loadMoreOrders() {
    try {
      const nextPage = page + 1;
      const data = await api.get(`/restaurants/${user.restaurantId}/orders`, {
        params: {
          page: nextPage,
          pageSize: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(sourceFilter ? { source: sourceFilter } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(fromDate ? { from: new Date(`${fromDate}T00:00:00`).toISOString() } : {}),
          ...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}),
        },
      });
      setOrders((current) => [...(current || []), ...data]);
      setPage(nextPage);
      setHasMore(data.length === 100);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}/integrations/status`).then(setIntegrationStatus).catch(() => setIntegrationStatus([]));
  }, [user.restaurantId]);

  async function openManualOrder() {
    setError(null);
    try {
      const [categories, tables] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/menu`),
        api.get(`/restaurants/${user.restaurantId}/tables`),
      ]);
      setManualMenu(categories.flatMap((category) => category.menuItems.filter((item) => item.isAvailable)));
      setManualTables(tables.filter((table) => table.isActive));
      setManualOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createManualOrder() {
    const items = Object.entries(manualItems).filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity: Number(quantity) }));
    if (!items.length) return setError("Add at least one available menu item.");
    if (manualType === "DINE_IN" && !manualTableId) return setError("Choose an active table.");
    setManualSaving(true);
    try {
      await api.post(`/restaurants/${user.restaurantId}/orders/manual`, {
        orderType: manualType,
        ...(manualType === "DINE_IN" ? { tableId: manualTableId } : {}),
        items,
      });
      setManualOpen(false);
      setManualItems({});
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setManualSaving(false);
    }
  }

  useEffect(() => {
    refresh();
    const socket = getSocket();
    const onNewOrder = () => {
      refresh();
      if (!soundEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.12);
        oscillator.onended = () => context.close();
      } catch { /* Audio optional */ }
    };
    socket.on("order:new", onNewOrder);
    socket.on("order:updated", refresh);
    return () => {
      socket.off("order:new", onNewOrder);
      socket.off("order:updated", refresh);
    };
  }, [refresh, soundEnabled]);

  const visibleOrders = useMemo(() => (orders || []).filter((order) => {
    if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
    if (typeFilter && order.orderType !== typeFilter) return false;
    if (sourceFilter && order.source !== sourceFilter) return false;
    return true;
  }), [orders, paymentFilter, typeFilter, sourceFilter]);

  const selected = orders?.find((o) => o.id === selectedId) || visibleOrders[0] || null;
  const activeOrders = (orders || []).filter((order) => !["COMPLETED", "CANCELLED"].includes(order.status));

  async function changeStatus(orderId, status) {
    setError(null);
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function printReceipt(orderId) {
    setError(null);
    try {
      const receipt = await api.get(`/orders/${orderId}/receipt`);
      const printWindow = window.open("", "_blank", "width=900,height=1000");
      if (!printWindow) {
        setError("Pop-up blocked. Please allow pop-ups to print a receipt.");
        return;
      }
      printWindow.document.write(buildReceiptMarkup(receipt));
      printWindow.document.close();
      setTimeout(() => printWindow.focus(), 200);
      setTimeout(() => printWindow.print(), 400);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Order Operations & Kitchen Queue"
        description="Live streaming table orders, direct takeaway requests, and digital kitchen receipts."
        actions={
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF7EE] text-[#269B67] border border-[#269B67]/20">
              <span className="w-2 h-2 rounded-full bg-[#269B67] animate-pulse" />
              Live Feed
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-secondary text-xs"
            >
              {soundEnabled ? "🔔 Chime: On" : "🔕 Chime: Off"}
            </button>
            {(user?.permissions?.includes("orders.create") || user?.permissions?.includes("*")) && (
              <button
                type="button"
                onClick={openManualOrder}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>New Manual Order</span>
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMN 1: Order Queue List (4 Cols) */}
        <div className="lg:col-span-4 card overflow-hidden flex flex-col min-h-[640px]">
          {/* Filters & Search */}
          <div className="p-3.5 border-b border-[#E5ECE9] bg-white space-y-2.5">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search order #, customer, table..."
              className="w-full"
              onClear={() => setSearch("")}
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input py-1.5 px-2 text-xs"
              >
                <option value="">All Statuses</option>
                {["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="input py-1.5 px-2 text-xs"
              >
                <option value="">All Payments</option>
                {["PENDING", "PAID", "FAILED", "REFUNDED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E5ECE9]">
            {!orders ? (
              <Spinner label="Loading live orders..." />
            ) : visibleOrders.length === 0 ? (
              <EmptyState title="No matching orders" subtitle="Adjust search or filters above." />
            ) : (
              visibleOrders.map((o) => {
                const isSelected = selected?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(o.id);
                      setSearchParams({ orderId: o.id });
                    }}
                    className={`w-full p-3.5 text-left transition border-l-4 ${
                      isSelected
                        ? "border-[#087F73] bg-[#E7F5F1]/30"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#172B2A]">{o.orderNumber}</span>
                      <StatusPill status={o.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#788582]">
                      <span>{o.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${o.table?.tableNumber || "—"}`}</span>
                      <span className="font-bold text-[#172B2A]">₹{Number(o.totalAmount).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#9CA8A5] mt-1.5">
                      <span>{o.customerName || "Dine-In Guest"}</span>
                      <span>{timeAgo(o.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}

            {orders && hasMore && (
              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={loadMoreOrders}
                  className="btn-secondary text-xs w-full"
                >
                  Load More Orders
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: Selected Order Ticket Details (5 Cols) */}
        <div className="lg:col-span-5 card p-5 min-h-[640px]">
          {!selected ? (
            <EmptyState
              icon={OrdersIcon}
              title="Select an order"
              subtitle="Choose an active order from the left queue to view items and update kitchen status."
            />
          ) : (
            <div className="space-y-4">
              {/* Order Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#E5ECE9]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[#172B2A]">{selected.orderNumber}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F0F4F2] text-[#788582]">
                      {selected.orderType}
                    </span>
                  </div>
                  <p className="text-xs text-[#788582] mt-0.5">
                    {selected.orderType === "TAKEAWAY" ? "Takeaway Order" : `Table ${selected.table?.tableNumber || "—"}`}
                    {selected.customerName ? ` · ${selected.customerName}` : ""}
                  </p>
                </div>
                <StatusPill status={selected.paymentStatus} />
              </div>

              {/* Status Stepper Progression */}
              <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#788582] mb-2">
                  Kitchen Progress State
                </p>
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                  {["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"].map((st, i) => {
                    const isDone = selected.status === st;
                    return (
                      <span
                        key={st}
                        className={`px-2 py-1 rounded-md transition ${
                          isDone
                            ? "bg-[#087F73] text-white"
                            : "bg-white text-[#9CA8A5] border border-[#E5ECE9]"
                        }`}
                      >
                        {st}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Order Items Table */}
              <div className="border border-[#E5ECE9] rounded-xl overflow-hidden">
                <div className="p-3 bg-[#F5F8F7] border-b border-[#E5ECE9] text-xs font-bold text-[#172B2A] flex justify-between">
                  <span>Ordered Items ({selected.items?.length || 0})</span>
                  <span>Amount</span>
                </div>
                <div className="p-3 space-y-2 text-xs divide-y divide-[#E5ECE9]">
                  {selected.items?.map((item) => (
                    <div key={item.id} className="pt-2 first:pt-0">
                      <div className="flex justify-between font-semibold text-[#172B2A]">
                        <span>{item.quantity}x {item.itemName}</span>
                        <span>₹{Number(item.lineTotal).toFixed(0)}</span>
                      </div>
                      {item.instructions && (
                        <p className="text-[11px] text-[#087F73] italic mt-0.5">
                          Note: "{item.instructions}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Subtotals & Taxes */}
                <div className="p-3 bg-[#F8FAF9] border-t border-[#E5ECE9] space-y-1.5 text-xs text-[#788582]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{Number(selected.subtotal).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (GST)</span>
                    <span>₹{Number(selected.taxAmount).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge</span>
                    <span>₹{Number(selected.serviceCharge).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#172B2A] pt-1.5 border-t border-[#E5ECE9]">
                    <span>Grand Total</span>
                    <span>₹{Number(selected.totalAmount).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Order State Action Controls */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => printReceipt(selected.id)}
                    className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
                  >
                    <span>Print Kitchen KOT</span>
                  </button>

                  {(NEXT_STATUS[selected.status] || []).map((nextSt) => (
                    <button
                      key={nextSt}
                      type="button"
                      onClick={() => changeStatus(selected.id, nextSt)}
                      className={`text-xs py-2 px-3.5 rounded-lg font-semibold transition ${
                        nextSt === "CANCELLED"
                          ? "border border-red-200 text-red-600 hover:bg-red-50"
                          : "btn-secondary"
                      }`}
                    >
                      Mark {nextSt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3: Operations & Kitchen Stats (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#172B2A] uppercase tracking-wider">
              Service Workload
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8E7] flex justify-between items-center">
                <span className="font-semibold text-[#E7A13A]">Waiting (Pending)</span>
                <span className="font-bold text-sm text-[#172B2A]">
                  {activeOrders.filter((o) => o.status === "PENDING").length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF4E5] flex justify-between items-center">
                <span className="font-semibold text-[#D96724]">Cooking (Preparing)</span>
                <span className="font-bold text-sm text-[#172B2A]">
                  {activeOrders.filter((o) => o.status === "PREPARING").length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#EAF7EE] flex justify-between items-center">
                <span className="font-semibold text-[#269B67]">Ready for Serving</span>
                <span className="font-bold text-sm text-[#172B2A]">
                  {activeOrders.filter((o) => o.status === "READY").length}
                </span>
              </div>
            </div>
          </div>

          {/* Integration Status Pill Card */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#172B2A] uppercase tracking-wider">
                Marketplace Sync
              </h3>
              <Link to="/admin/integrations" className="text-[11px] font-semibold text-[#087F73] hover:underline">
                Config →
              </Link>
            </div>
            <div className="space-y-1.5 text-xs text-[#788582]">
              {integrationStatus.map((intg) => (
                <div key={intg.provider} className="flex justify-between items-center py-1">
                  <span className="font-medium text-[#172B2A]">{intg.provider.replace(/_/g, " ")}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#788582]">
                    {intg.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Order Creation Modal */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-lg w-full max-h-[85vh] flex flex-col p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
              <h3 className="text-base font-bold text-[#172B2A]">Create New Manual Ticket</h3>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  className="input"
                >
                  <option value="TAKEAWAY">Takeaway</option>
                  <option value="DINE_IN">Dine In</option>
                </select>
                {manualType === "DINE_IN" && (
                  <select
                    value={manualTableId}
                    onChange={(e) => setManualTableId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select Table</option>
                    {manualTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.tableNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 border border-[#E5ECE9] rounded-xl p-3 max-h-60 overflow-y-auto">
                {manualMenu.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b border-[#E5ECE9] last:border-b-0">
                    <div>
                      <p className="font-semibold text-[#172B2A]">{item.name}</p>
                      <p className="text-[10px] text-[#788582]">₹{item.price}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={manualItems[item.id] || 0}
                      onChange={(e) =>
                        setManualItems((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="input w-16 text-center py-1 font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5ECE9]">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manualSaving}
                onClick={createManualOrder}
                className="btn-primary text-xs"
              >
                {manualSaving ? "Creating..." : "Confirm & Send to Kitchen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildReceiptMarkup(receipt) {
  const lines = receipt.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.itemName)}</td>
      <td>${item.quantity}</td>
      <td>₹${Number(item.unitPrice).toFixed(0)}</td>
      <td>₹${Number(item.lineTotal).toFixed(0)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${escapeHtml(receipt.orderNumber)}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { font-family: Inter, Arial, sans-serif; background: #fff; padding: 24px; color: #172B2A; }
          .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #E5ECE9; padding: 24px; border-radius: 8px; }
          .header { text-align: center; margin-bottom: 20px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #E5ECE9; padding: 8px 4px; text-align: left; }
          .totals { width: 220px; margin-left: auto; margin-top: 16px; font-size: 12px; }
          .totals div { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .grand { font-weight: bold; border-top: 1px solid #172B2A; padding-top: 6px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h2>${escapeHtml(receipt.restaurantName)}</h2>
            <p style="font-size:12px; color:#788582;">${receipt.orderTypeLabel} Receipt</p>
          </div>
          <div class="meta">
            <div><strong>Order:</strong> ${escapeHtml(receipt.orderNumber)}</div>
            <div><strong>Date:</strong> ${new Date(receipt.orderDate).toLocaleString("en-IN")}</div>
            ${receipt.tableNumber ? `<div><strong>Table:</strong> ${escapeHtml(receipt.tableNumber)}</div>` : ""}
            <div><strong>Payment:</strong> ${escapeHtml(receipt.paymentStatus)}</div>
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal</span><span>₹${Number(receipt.subtotal).toFixed(0)}</span></div>
            <div><span>Tax</span><span>₹${Number(receipt.tax).toFixed(0)}</span></div>
            <div class="grand"><span>Total</span><span>₹${Number(receipt.grandTotal).toFixed(0)}</span></div>
          </div>
        </div>
      </body>
    </html>`;
}

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
