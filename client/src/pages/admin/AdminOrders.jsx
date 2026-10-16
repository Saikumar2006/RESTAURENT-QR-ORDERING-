import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import { EmptyState, ErrorBanner, PageHeader, SectionHeading, Spinner, StatCard, StatusBadge } from "../../components/Ui.jsx";

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
  }, [user.restaurantId, statusFilter, sourceFilter, fromDate, toDate]);

  async function loadMoreOrders() {
    try {
      const nextPage = page + 1;
      const data = await api.get(`/restaurants/${user.restaurantId}/orders`, { params: { page: nextPage, pageSize: 100, ...(statusFilter ? { status: statusFilter } : {}), ...(sourceFilter ? { source: sourceFilter } : {}), ...(fromDate ? { from: new Date(`${fromDate}T00:00:00`).toISOString() } : {}), ...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}) } });
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
      } catch { /* Sound is optional when audio is unavailable. */ }
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
    if (search) {
      const query = search.toLowerCase();
      const haystack = `${order.orderNumber} ${order.customerName || ""} ${order.customerPhone || ""} ${order.table?.tableNumber || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }), [orders, paymentFilter, typeFilter, sourceFilter, search]);
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
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Orders" description="One queue for Svaadya and staff-entered orders." actions={<div className="flex items-center gap-3"><span className="live-indicator"><span /> Live feed</span><button className="btn-secondary py-2 px-3 text-xs" onClick={() => setSoundEnabled((enabled) => !enabled)}>{soundEnabled ? "Sound on" : "Sound off"}</button>{user?.permissions?.includes("orders.create") || user?.permissions?.includes("*") ? <button className="btn-primary py-2 px-3 text-xs" onClick={openManualOrder}>New manual order</button> : null}</div>} />
      {error && <ErrorBanner message={error} />}

      <section className="orders-panel p-4">
        <SectionHeading title="Order channels" detail="Marketplace partners require approved credentials before live sync can be enabled." />
        <div className="flex flex-wrap gap-2 text-xs">{integrationStatus.map((integration) => <span key={integration.provider} title={integration.reason || ""} className="rounded-full border border-charcoal/10 px-3 py-1.5"><b>{integration.provider.replaceAll("_", " ")}</b> · {integration.status === "NOT_CONFIGURED" ? "Not connected" : integration.status}</span>)}</div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(250px,0.8fr)_minmax(360px,1.2fr)_minmax(250px,0.72fr)]">
        <section className="orders-panel flex min-h-[620px] min-w-0 flex-col overflow-hidden">
          <div className="border-b border-charcoal/10 p-4">
            <SectionHeading title="Order queue" detail={`${visibleOrders.length} shown · newest first`} />
            <div className="space-y-2">
              <input className="input" placeholder="Search order, customer, table" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search orders" />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by order status">
                  <option value="">All statuses</option>
                  {["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select className="input" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} aria-label="Filter by payment status">
                  <option value="">All payments</option>
                  {["PENDING", "PAID", "FAILED", "REFUNDED"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input className="input" type="date" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                <input className="input" type="date" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
              <select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by order type">
                <option value="">Dine-in and takeaway</option><option value="DINE_IN">Dine In</option><option value="TAKEAWAY">Takeaway</option>
              </select>
              <select className="input" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter by order source">
                <option value="">All sources</option><option value="SVAADYA_QR">Svaadya QR</option><option value="SVAADYA_WEBSITE">Svaadya website</option><option value="SWIGGY">Swiggy</option><option value="ZOMATO">Zomato</option><option value="MANUAL">Manual</option>
              </select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-charcoal/10">
            {!orders && error ? (
              <div className="p-5 space-y-3">
                <ErrorBanner message={error} />
                <button className="btn-secondary" onClick={refresh}>Retry loading orders</button>
              </div>
            ) : !orders ? (
              <Spinner />
            ) : visibleOrders.length === 0 ? (
              <EmptyState title="No matching orders" subtitle="Try changing your search or filters." />
            ) : (
              visibleOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedId(o.id);
                    setSearchParams({ orderId: o.id });
                  }}
                  className={`w-full border-l-2 px-4 py-3 text-left transition hover:bg-[#f8faf8] ${selected?.id === o.id ? "border-clove bg-clove/[0.04]" : "border-transparent"}`}
                >
                  <div className="flex justify-between">
                    <p className="font-semibold text-sm">{o.orderNumber}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-charcoal/50">{o.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${o.table?.tableNumber || "—"}`} · ₹{Number(o.totalAmount).toFixed(0)}</p>
                  <p className="mt-1 text-[10px] text-clove/70">{(o.source || "SVAADYA_QR").replaceAll("_", " ")}{o.externalOrderId ? ` · ${o.externalOrderId}` : ""}</p>
                  <p className="mt-1 truncate text-[10px] text-charcoal/40">{o.customerName || o.customerPhone || "Guest"} · {timeAgo(o.createdAt)}</p>
                </button>
              ))
            )}
            {orders && hasMore && <div className="p-3 text-center"><button className="btn-secondary px-4 py-2 text-xs" onClick={loadMoreOrders}>Load more orders</button></div>}
          </div>
        </section>

        <section className="orders-panel min-h-[620px] min-w-0 p-5 md:p-6">
        {!selected ? (
          <EmptyState title="Select an order" subtitle="Choose an order from the queue to view its details." />
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between mb-1">
              <div><p className="section-eyebrow !ml-0">Order details</p><h2 className="font-display text-2xl">{selected.orderNumber}</h2></div>
              <StatusBadge status={selected.paymentStatus} />
            </div>
            <p className="text-sm text-charcoal/55 mb-5">
              {selected.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${selected.table?.tableNumber}`}{" "}
              {selected.customerName ? `· ${selected.customerName}` : ""} {selected.customerPhone ? `· ${selected.customerPhone}` : ""}
            </p>

            <div className="orders-panel p-5 mb-4">
              <SectionHeading title="Items" detail={`${selected.items?.length || 0} line items`} />
              <div className="space-y-2 text-sm">
                {selected.items?.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between">
                      <span>{item.quantity} × {item.itemName}</span>
                      <span>₹{Number(item.lineTotal).toFixed(0)}</span>
                    </div>
                    {item.instructions && <p className="text-xs text-charcoal/50 italic">"{item.instructions}"</p>}
                  </div>
                ))}
              </div>
              <div className="border-t border-charcoal/10 mt-4 pt-3 space-y-1.5 text-sm text-charcoal/60">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(selected.subtotal).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{Number(selected.taxAmount).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Service charge</span><span>₹{Number(selected.serviceCharge).toFixed(0)}</span></div>
                <div className="flex justify-between font-semibold text-charcoal text-base pt-1"><span>Total</span><span>₹{Number(selected.totalAmount).toFixed(0)}</span></div>
              </div>
            </div>

            {selected.feedback && (
              <div className="orders-panel p-5 mb-4">
                <h3 className="font-semibold text-sm mb-2">Customer Feedback</h3>
                <p className="text-lg mb-1">
                  {"★".repeat(selected.feedback.rating)}
                  {"☆".repeat(5 - selected.feedback.rating)}
                </p>
                {selected.feedback.comment && <p className="text-sm text-charcoal/70">"{selected.feedback.comment}"</p>}
              </div>
            )}

            <div className="orders-panel p-5">
              <SectionHeading title="Order progress" detail="Allowed transitions only" />
              <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[10px] text-charcoal/40">
                {["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"].map((status, index) => <React.Fragment key={status}><span className={selected.status === status ? "font-bold text-clove" : ""}>{status}</span>{index < 4 && <span aria-hidden="true">›</span>}</React.Fragment>)}
              </div>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={selected.status} />
                <button className="btn-primary py-1.5 px-4 text-xs" onClick={() => printReceipt(selected.id)}>
                  Print Receipt
                </button>
                {(NEXT_STATUS[selected.status] || []).map((s) => (
                  <button key={s} className="btn-secondary py-1.5 px-4 text-xs" onClick={() => changeStatus(selected.id, s)}>
                    Mark {s}
                  </button>
                ))}
                {(NEXT_STATUS[selected.status] || []).length === 0 && (
                  <p className="text-xs text-charcoal/40">No further status changes available.</p>
                )}
              </div>
            </div>
          </div>
        )}
        </section>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2 2xl:grid-cols-1">
            <StatCard label="Orders · 7 days" value={insights?.summary.orderCount ?? "—"} detail="All statuses" />
            <StatCard label="Paid revenue · 7 days" value={insights ? `₹${Number(insights.summary.paidRevenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"} detail="Settled payments" accent="amber" />
            <StatCard label="Active now" value={activeOrders.length} detail="From loaded queue" accent="blue" />
            <StatCard label="Average paid order" value={insights ? `₹${Number(insights.summary.averagePaidOrderValue).toFixed(0)}` : "—"} detail="7-day average" />
          </div>
          <div className="orders-panel p-5">
            <SectionHeading title="Active orders" detail="Restaurant queue" />
            {activeOrders.length === 0 ? <p className="py-5 text-center text-xs text-charcoal/45">No active orders in the loaded queue.</p> : <div className="space-y-3">{activeOrders.slice(0, 6).map((order) => <button key={order.id} className="flex w-full items-center justify-between gap-2 text-left" onClick={() => { setSelectedId(order.id); setSearchParams({ orderId: order.id }); }}><span className="min-w-0"><span className="block truncate text-xs font-semibold">{order.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${order.table?.tableNumber || "—"}`}</span><span className="text-[10px] text-charcoal/45">{timeAgo(order.createdAt)}</span></span><StatusBadge status={order.status} /></button>)}</div>}
          </div>
        </aside>
      </div>
      {manualOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-order-title"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 id="manual-order-title" className="font-display text-xl">New manual order</h2><button className="text-sm text-charcoal/60" onClick={() => setManualOpen(false)}>Close</button></div><p className="mb-4 text-xs text-charcoal/55">Prices and availability are verified by the server. Payment remains pending for staff reconciliation.</p><div className="mb-4 grid gap-3 sm:grid-cols-2"><select className="input" value={manualType} onChange={(event) => setManualType(event.target.value)}><option value="TAKEAWAY">Takeaway</option><option value="DINE_IN">Dine in</option></select>{manualType === "DINE_IN" && <select className="input" value={manualTableId} onChange={(event) => setManualTableId(event.target.value)}><option value="">Choose table</option>{manualTables.map((table) => <option key={table.id} value={table.id}>{table.tableNumber}</option>)}</select>}</div><div className="max-h-72 space-y-2 overflow-auto">{manualMenu.map((item) => <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-charcoal/10 p-3 text-sm"><span>{item.name} · ₹{Number(item.price).toFixed(2)}</span><input className="input w-20" type="number" min="0" max="50" value={manualItems[item.id] || 0} onChange={(event) => setManualItems((state) => ({ ...state, [item.id]: Math.max(0, Math.min(50, Number(event.target.value) || 0)) }))} aria-label={`Quantity for ${item.name}`} /></label>)}</div><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setManualOpen(false)}>Cancel</button><button className="btn-primary" disabled={manualSaving} onClick={createManualOrder}>{manualSaving ? "Creating…" : "Create order"}</button></div></div></div>}
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
          @media print {
            body { margin: 0; background: white; }
            .receipt { box-shadow: none; border: none; }
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            background: #f5f5f5;
            color: #111827;
            margin: 0;
            padding: 24px;
          }
          .receipt {
            max-width: 780px;
            margin: 0 auto;
            background: white;
            border: 1px solid #d1d5db;
            padding: 24px 24px 18px;
            box-shadow: 0 5px 18px rgba(0,0,0,0.04);
          }
          h1, h2, p { margin: 0; }
          .header { text-align: center; margin-bottom: 18px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 7px 4px; vertical-align: top; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; color: #4b5563; }
          .totals { margin-top: 14px; width: 260px; margin-left: auto; font-size: 13px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .grand { font-weight: 700; border-top: 1px solid #111827; margin-top: 6px; padding-top: 8px; }
          .footer { margin-top: 20px; font-size: 11px; color: #4b5563; text-align: center; }
          @media (max-width: 680px) {
            .meta { grid-template-columns: 1fr; }
            .receipt { padding: 18px 14px; }
            .totals { width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>${escapeHtml(receipt.restaurantName)}</h1>
            <p style="font-size:12px; margin-top:6px;">${receipt.orderTypeLabel} Receipt</p>
          </div>

          <div class="meta">
            <div><strong>Order ID:</strong> ${escapeHtml(receipt.orderNumber)}</div>
            <div><strong>Date:</strong> ${new Date(receipt.orderDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div><strong>Order Type:</strong> ${receipt.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE IN"}</div>
            ${receipt.tableNumber ? `<div><strong>Table:</strong> ${escapeHtml(receipt.tableNumber)}</div>` : ""}
            ${receipt.customerName ? `<div><strong>Customer:</strong> ${escapeHtml(receipt.customerName)}</div>` : ""}
            ${receipt.customerPhone ? `<div><strong>Phone:</strong> ${escapeHtml(receipt.customerPhone)}</div>` : ""}
            <div><strong>Payment:</strong> ${escapeHtml(receipt.paymentStatus)}</div>
            <div><strong>Status:</strong> ${escapeHtml(receipt.orderStatus)}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>₹${Number(receipt.subtotal).toFixed(0)}</span></div>
            <div class="totals-row"><span>Tax</span><span>₹${Number(receipt.tax).toFixed(0)}</span></div>
            <div class="totals-row"><span>Discount</span><span>₹${Number(receipt.discount).toFixed(0)}</span></div>
            <div class="totals-row grand"><span>Grand Total</span><span>₹${Number(receipt.grandTotal).toFixed(0)}</span></div>
          </div>

          <div class="footer">Thank you for visiting ${escapeHtml(receipt.restaurantName)}.</div>
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
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} d ago`;
}
