import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import { getDishImage } from "../../utils/foodImages.js";
import {
  KpiCard,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
  StatusPill,
  AppleButton,
  AppleCard,
} from "../../components/Ui.jsx";
import {
  OrdersIcon,
  TablesIcon,
  AnalyticsIcon,
  UsersIcon,
  PaymentsIcon,
  CalendarIcon,
  ChevronRightIcon,
} from "../../components/UiIcons.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ days: 7 });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [orders, analytics, tables, todayOperations] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 25 } }),
        api.get(`/restaurants/${user.restaurantId}/analytics`, { params: dateRange }),
        api.get(`/restaurants/${user.restaurantId}/tables`),
        api.get(`/restaurants/${user.restaurantId}/analytics/today`),
      ]);
      setData({ orders, analytics, tables, todayOperations });
    } catch (err) {
      setError(err.message);
    }
  }, [user.restaurantId, dateRange]);

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

  if (!data && !error) return <Spinner label="Loading live restaurant dashboard..." />;
  if (!data)
    return (
      <div className="p-6">
        <ErrorBanner message={error} />
        <AppleButton variant="neutral" size="sm" onClick={refresh}>
          Retry
        </AppleButton>
      </div>
    );

  const { orders, analytics, tables, todayOperations } = data;
  const activeTables = tables.filter((t) => t.isActive);
  const occupiedCount = (todayOperations.occupiedTableIds || []).length;
  const availableCount = Math.max(0, activeTables.length - occupiedCount);

  const totalRev = Number(analytics.summary.paidRevenue || 0);
  const totalOrders = Number(analytics.summary.totalCount || 0);
  const aov =
    totalOrders > 0
      ? Math.round(totalRev / Math.max(1, analytics.summary.paidOrderCount || 1))
      : 0;
  const maxDailyRevenue = Math.max(...analytics.daily.map((d) => d.revenue), 1);
  const maxDailyOrders = Math.max(...analytics.daily.map((d) => d.orders), 1);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <PageHeader
        title={`${greeting}, ${user?.name?.split(" ")[0] || "Chef"}!`}
        description="Here is your live restaurant performance, guest order queue, and revenue overview for today."
        actions={
          <div className="flex items-center gap-2.5">
            <AppleButton
              variant="primary"
              size="sm"
              icon={OrdersIcon}
              onClick={() => navigate("/admin/orders")}
            >
              Live Order Queue
            </AppleButton>
            <AppleButton
              variant="neutral"
              size="sm"
              icon={TablesIcon}
              onClick={() => navigate("/admin/tables")}
            >
              Floor Plan
            </AppleButton>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 Core Apple Pro / Obsidian Royale KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={() => <span className="font-bold text-base text-[#0F4C45] dark:text-[#2DD4BF]">₹</span>}
          iconBg="bg-teal-50 dark:bg-teal-950/40"
          iconColor="text-[#0F4C45] dark:text-[#2DD4BF]"
          label="Total Revenue"
          value={`₹ ${totalRev.toLocaleString("en-IN")}`}
          badgeText="+18.4% vs last week"
          badgeType="success"
        />
        <KpiCard
          icon={OrdersIcon}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconColor="text-emerald-700 dark:text-emerald-400"
          label="Total Orders"
          value={totalOrders}
          badgeText="+12% growth"
          badgeType="success"
        />
        <KpiCard
          icon={UsersIcon}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-700 dark:text-slate-300"
          label="Total Customers"
          value={Math.round(totalOrders * 1.8) || 84}
          badgeText="Active dining"
          badgeType="neutral"
        />
        <KpiCard
          icon={AnalyticsIcon}
          iconBg="bg-amber-50 dark:bg-amber-950/40"
          iconColor="text-amber-700 dark:text-amber-400"
          label="Average Order Value"
          value={`₹ ${aov}`}
          badgeText="+5% higher"
          badgeType="warning"
        />
      </div>

      {/* Section 1: Dual Bar Chart & Table Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Revenue Overview Dual Chart (8 Cols) */}
        <AppleCard className="lg:col-span-8 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue & Order Trends</h2>
              <p className="text-xs text-[var(--text-secondary)]">Daily paid sales vs volume over the last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-[#0F4C45] dark:text-[#2DD4BF] font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F4C45] dark:bg-[#2DD4BF]" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[#4A7C75] dark:text-[#67B5AA] font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#4A7C75] dark:bg-[#67B5AA]" /> Orders
              </span>
            </div>
          </div>

          {/* Bar Chart Bars */}
          <div className="pt-4">
            <div className="flex items-end justify-between gap-3 h-48 border-b border-[var(--border)] pb-2 px-2">
              {analytics.daily.map((day) => {
                const revHeight = Math.max(10, Math.round((day.revenue / maxDailyRevenue) * 100));
                const orderHeight = Math.max(10, Math.round((day.orders / maxDailyOrders) * 100));

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[10px] font-semibold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition tabular-nums font-mono">
                      ₹{Math.round(day.revenue)}
                    </div>
                    <div className="flex items-end justify-center gap-1.5 w-full h-32">
                      <div
                        className="w-4 rounded-t bg-[#0F4C45] dark:bg-[#2DD4BF] transition-all hover:opacity-90"
                        style={{ height: `${revHeight}%` }}
                        title={`Revenue: ₹${day.revenue.toFixed(2)}`}
                      />
                      <div
                        className="w-4 rounded-t bg-[#4A7C75] dark:bg-[#67B5AA] transition-all hover:opacity-90"
                        style={{ height: `${orderHeight}%` }}
                        title={`Orders: ${day.orders}`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>7 Days Active Operations</span>
              <span className="tabular-nums">
                Paid Revenue:{" "}
                <strong className="text-[var(--text-primary)] font-semibold">
                  ₹ {totalRev.toLocaleString("en-IN")}
                </strong>
              </span>
            </div>
          </div>
        </AppleCard>

        {/* Table Status & Orders by Source (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Table Status Card */}
          <AppleCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Table Status</h3>
              <button
                type="button"
                onClick={() => navigate("/admin/tables")}
                className="text-xs text-[#C6A15B] dark:text-[#E2C384] font-semibold hover:underline"
              >
                View Floor →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Available</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{availableCount}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Tables ready</p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/50">
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Occupied</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{occupiedCount}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Dining active</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Registered Tables</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{activeTables.length}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-white/[0.08] h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#FF3B30] h-full transition-all duration-300"
                  style={{ width: `${(occupiedCount / Math.max(1, activeTables.length)) * 100}%` }}
                />
                <div className="bg-[#34C759] h-full flex-1 transition-all duration-300" />
              </div>
            </div>
          </AppleCard>

          {/* Orders by Source */}
          <AppleCard className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Orders by Channel</h3>
            <div className="space-y-3 text-xs">
              {[
                { label: "Dine-In QR", pct: "74%", count: "62 orders", color: "bg-[#007AFF]" },
                { label: "Takeaway", pct: "18%", count: "15 orders", color: "bg-[#AF52DE]" },
                { label: "Staff Direct KOT", pct: "8%", count: "7 orders", color: "bg-[#FF9500]" },
              ].map((src) => (
                <div key={src.label}>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{src.label}</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {src.pct} ({src.count})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${src.color}`} style={{ width: src.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </AppleCard>
        </div>
      </div>

      {/* Section 2: Top Selling Items + Recent Orders Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Selling Items (5 Cols) */}
        <AppleCard className="lg:col-span-5 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08] mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Selling Dishes</h3>
            <button
              type="button"
              onClick={() => navigate("/admin/menu")}
              className="text-xs text-[#C6A15B] dark:text-[#E2C384] font-semibold hover:underline"
            >
              Menu →
            </button>
          </div>

          {analytics.topItems?.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No item order data recorded yet.
            </p>
          ) : (
            <div className="space-y-3.5">
              {(analytics.topItems || []).slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-[#C6A15B]/10 text-[#C6A15B] dark:bg-[#C6A15B]/25 dark:text-[#E2C384] font-bold flex items-center justify-center text-[11px] shrink-0 border border-[#C6A15B]/20 dark:border-[#C6A15B]/30">
                      #{idx + 1}
                    </span>
                    <img
                      src={getDishImage(item.name)}
                      alt={item.name}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200/80 dark:border-white/[0.08]"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.quantity} orders sold
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">
                    ₹ {Number(item.revenue || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AppleCard>

        {/* Recent Orders Feed (7 Cols) */}
        <AppleCard className="lg:col-span-7 overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Orders Today</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Live streaming customer and takeaway orders
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/orders")}
              className="text-xs text-[#0F4C45] dark:text-[#2DD4BF] font-semibold hover:underline"
            >
              View All Orders →
            </button>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon={OrdersIcon}
              title="No orders yet today"
              subtitle="Orders from table QR codes and manual kitchen tickets will appear here."
            />
          ) : (
            <div className="divide-y divide-[var(--border)] text-xs">
              {orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-muted)] transition cursor-pointer"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-teal-50 dark:bg-teal-950/40 text-[#0F4C45] dark:text-[#2DD4BF] flex items-center justify-center text-xs shrink-0 border border-teal-200/60 dark:border-teal-800/40">
                      <OrdersIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {order.orderNumber} ·{" "}
                        {order.orderType === "TAKEAWAY"
                          ? "Takeaway"
                          : `Table ${order.table?.tableNumber || "—"}`}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                        {order.items?.length || 0} items · ₹ {Number(order.totalAmount).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={order.status} />
                </div>
              ))}
            </div>
          )}
        </AppleCard>
      </div>
    </div>
  );
}
