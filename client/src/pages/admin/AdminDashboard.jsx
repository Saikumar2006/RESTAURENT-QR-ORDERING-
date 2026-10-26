import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import { EmptyState, ErrorBanner, PageHeader, SectionHeading, Spinner, StatCard, StatusBadge } from "../../components/Ui.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rangeDraft, setRangeDraft] = useState({ from: "", to: "" });
  const [rangeApplied, setRangeApplied] = useState({ from: "", to: "" });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [orders, analytics, tables, todayOperations] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 25 } }),
        api.get(`/restaurants/${user.restaurantId}/analytics`, { params: rangeApplied.from ? rangeApplied : { days: 7 } }),
        api.get(`/restaurants/${user.restaurantId}/tables`),
        api.get(`/restaurants/${user.restaurantId}/analytics/today`),
      ]);
      setData({ orders, analytics, tables, todayOperations });
    } catch (err) {
      setError(err.message);
    }
  }, [user.restaurantId, rangeApplied]);

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

  if (!data && !error) return <Spinner label="Loading restaurant operations..." />;

  if (!data) return <div className="p-5 md:p-8"><ErrorBanner message={error} /><button className="btn-secondary" onClick={refresh}>Retry</button></div>;

  const { orders, analytics, tables, todayOperations } = data;
  const activeOrders = orders.filter((order) => !["COMPLETED", "CANCELLED"].includes(order.status));
  const today = { revenue: todayOperations.summary.paidRevenue, orders: todayOperations.summary.orderCount };
  const activeTableIds = new Set(activeOrders.map((order) => order.tableId).filter(Boolean));
  const activeTables = tables.filter((table) => table.isActive);
  const occupiedTables = activeTables.filter((table) => activeTableIds.has(table.id)).length;
  const maxRevenue = Math.max(...analytics.daily.map((day) => day.revenue), 1);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  function applyDateRange(event) {
    event.preventDefault();
    if (!rangeDraft.from || !rangeDraft.to) {
      setError("Choose both a start date and an end date.");
      return;
    }
    setError(null);
    setRangeApplied({ ...rangeDraft });
  }

  function resetDateRange() {
    setRangeDraft({ from: "", to: "" });
    setRangeApplied({ from: "", to: "" });
    setError(null);
  }

  return (
    <div className="space-y-6 p-5 md:p-8">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${user?.name?.split(" ")[0] || "there"}`}
        description="A live view of today's service and recent performance."
        actions={<button className="btn-secondary" onClick={() => navigate("/admin/tables")}>Manage tables</button>}
      />
      {error && <ErrorBanner message={error} />}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Paid revenue today" value={`₹${Number(today?.revenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} detail="Settled customer orders" />
        <StatCard label="Orders today" value={today?.orders || 0} detail="All order statuses" accent="amber" />
        <StatCard label="Active orders" value={analytics.summary.activeCount} detail="Across the selected period" accent="blue" />
        <StatCard label="Tables occupied" value={`${occupiedTables} / ${activeTables.length}`} detail={`${Math.max(0, activeTables.length - occupiedTables)} available`} accent="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="card p-5 md:p-6">
          <SectionHeading title="Revenue overview" detail={`Paid restaurant orders · ${analytics.daily[0]?.date} to ${analytics.daily.at(-1)?.date}`} action={<span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Live data</span>} />
          <form onSubmit={applyDateRange} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-medium text-charcoal/55">From
              <input className="input mt-1 min-w-36 py-2 text-xs" type="date" value={rangeDraft.from} onChange={(event) => setRangeDraft({ ...rangeDraft, from: event.target.value })} />
            </label>
            <label className="text-[11px] font-medium text-charcoal/55">To
              <input className="input mt-1 min-w-36 py-2 text-xs" type="date" value={rangeDraft.to} onChange={(event) => setRangeDraft({ ...rangeDraft, to: event.target.value })} />
            </label>
            <button type="submit" className="btn-secondary text-xs">Apply range</button>
            {rangeApplied.from && <button type="button" className="text-xs font-medium text-clove underline" onClick={resetDateRange}>Last 7 days</button>}
          </form>
          {analytics.summary.paidOrderCount === 0 ? (
            <EmptyState title="No paid orders in this period" subtitle="Revenue will appear here when customer payments are recorded." />
          ) : (
            <div className="pt-3">
              <div className="mb-5 flex items-end justify-between gap-2 border-b border-charcoal/10 pb-2">
                {analytics.daily.map((day) => (
                  <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] tabular-nums text-charcoal/45">{day.revenue ? `₹${Math.round(day.revenue)}` : ""}</span>
                    <div className="flex h-28 w-full items-end justify-center">
                      <div className="w-7 max-w-[70%] rounded-t-sm bg-clove/80 transition-all" style={{ height: `${Math.max(day.revenue ? 8 : 2, (day.revenue / maxRevenue) * 100)}%` }} title={`${day.date}: ₹${day.revenue.toFixed(2)}`} />
                    </div>
                    <span className="text-[10px] text-charcoal/45">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-charcoal/50">7-day paid revenue <strong className="ml-1 font-semibold text-charcoal">₹{Number(analytics.summary.paidRevenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong></p>
            </div>
          )}
        </div>

        <div className="card p-5 md:p-6">
          <SectionHeading title="Service now" detail="Current workload from open orders" />
          <div className="divide-y divide-charcoal/10">
            {[["Waiting", activeOrders.filter((order) => order.status === "PENDING").length, "text-amber-700"], ["Preparing", activeOrders.filter((order) => order.status === "PREPARING").length, "text-blue-700"], ["Ready", activeOrders.filter((order) => order.status === "READY").length, "text-emerald-700"]].map(([label, value, color]) => (
              <div key={label} className="flex items-center justify-between py-3"><span className="text-sm text-charcoal/65">{label}</span><span className={`text-lg font-semibold tabular-nums ${color}`}>{value}</span></div>
            ))}
          </div>
          <button className="btn-secondary mt-4 w-full" onClick={() => navigate("/admin/orders")}>Open order queue</button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-charcoal/10 px-5 py-4">
          <SectionHeading
            title="Today's 5 recent orders"
            detail={`Restaurant business day · ${todayOperations.businessDate} · ${todayOperations.timeZone}`}
            action={<button className="text-xs font-semibold text-clove" onClick={() => navigate("/admin/orders")}>View all orders</button>}
          />
        </div>
        {todayOperations.recentOrders.length === 0 ? (
          <EmptyState title="No orders today" subtitle="Orders from this restaurant's business day will appear here." />
        ) : (
          <div className="divide-y divide-charcoal/10">
            {todayOperations.recentOrders.map((order) => (
              <button key={order.id} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[#f8faf8]" onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{order.orderNumber} <span className="font-normal text-charcoal/50">· {order.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${order.table?.tableNumber || "—"}`}</span></p>
                  <p className="mt-1 text-xs text-charcoal/45">{order.items?.length || 0} line items · ₹{Number(order.totalAmount).toFixed(0)} · {timeAgo(order.createdAt)}</p>
                </div>
                <StatusBadge status={order.status} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-charcoal/10 px-5 py-4"><SectionHeading title="Live order feed" detail="Recent orders from your restaurant" action={<button className="text-xs font-semibold text-clove" onClick={() => navigate("/admin/orders")}>View all →</button>} /></div>
          {activeOrders.length === 0 ? <EmptyState title="No active orders" subtitle="New customer orders will appear here." /> : (
            <div className="divide-y divide-charcoal/10">
              {activeOrders.slice(0, 7).map((order) => (
                <button key={order.id} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[#f8faf8]" onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{order.orderNumber} <span className="font-normal text-charcoal/50">· {order.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${order.table?.tableNumber || "—"}`}</span></p><p className="mt-1 text-xs text-charcoal/45">{order.items?.length || 0} line items · ₹{Number(order.totalAmount).toFixed(0)} · {timeAgo(order.createdAt)}</p></div>
                  <StatusBadge status={order.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 md:p-6">
          <SectionHeading title="Top items" detail="By units on recent orders" />
          {analytics.topItems.length === 0 ? <p className="py-8 text-center text-sm text-charcoal/45">Item performance appears after orders arrive.</p> : (
            <div className="space-y-4">
              {analytics.topItems.slice(0, 5).map((item, index) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded bg-[#eff4ef] text-xs font-semibold text-charcoal/55">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-[10px] text-charcoal/45">{item.quantity} sold</p></div>
                  <span className="text-xs font-semibold tabular-nums">₹{Number(item.revenue).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-2 border-t border-charcoal/10 pt-5">
        {[["Add menu item", "/admin/menu"], ["Add a table", "/admin/tables"], ["Create promotion", "/admin/coupons"], ["View reports", "/admin/reports"]].map(([label, href]) => <button key={href} className="btn-secondary text-xs" onClick={() => navigate(href)}>{label}</button>)}
      </section>
    </div>
  );
}

function timeAgo(dateString) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
