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
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("orderId"));
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get(`/restaurants/${user.restaurantId}/orders`, {
        params: {
          pageSize: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(fromDate ? { from: new Date(`${fromDate}T00:00:00`).toISOString() } : {}),
          ...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}),
        },
      });
      setOrders(data);
    } catch (err) {
      setError(err.message);
    }
    try {
      setInsights(await api.get(`/restaurants/${user.restaurantId}/analytics`, { params: { days: 7 } }));
    } catch {
      setInsights(null);
    }
  }, [user.restaurantId, statusFilter, fromDate, toDate]);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    socket.on("order:new", refresh);
    socket.on("order:updated", refresh);
    return () => {
      socket.off("order:new", refresh);
      socket.off("order:updated", refresh);
    };
  }, [refresh]);

  const visibleOrders = useMemo(() => (orders || []).filter((order) => {
    if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
    if (typeFilter && order.orderType !== typeFilter) return false;
    if (search) {
      const query = search.toLowerCase();
      const haystack = `${order.orderNumber} ${order.customerName || ""} ${order.customerPhone || ""} ${order.table?.tableNumber || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }), [orders, paymentFilter, typeFilter, search]);
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

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Orders" description="Triage incoming orders, update kitchen progress, and review payment status." actions={<span className="live-indicator"><span /> Updating from restaurant feed</span>} />
      {error && <ErrorBanner message={error} />}

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
                  <p className="mt-1 truncate text-[10px] text-charcoal/40">{o.customerName || o.customerPhone || "Guest"} · {timeAgo(o.createdAt)}</p>
                </button>
              ))
            )}
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
    </div>
  );
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} d ago`;
}
