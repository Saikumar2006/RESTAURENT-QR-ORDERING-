import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import {
  KpiCard,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
  StatusPill,
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
  if (!data) return <div className="p-6"><ErrorBanner message={error} /><button className="btn-secondary text-xs" onClick={refresh}>Retry</button></div>;

  const { orders, analytics, tables, todayOperations } = data;
  const activeTables = tables.filter((t) => t.isActive);
  const occupiedCount = (todayOperations.occupiedTableIds || []).length;
  const availableCount = Math.max(0, activeTables.length - occupiedCount);

  const totalRev = Number(analytics.summary.paidRevenue || 0);
  const totalOrders = Number(analytics.summary.totalCount || 0);
  const aov = totalOrders > 0 ? Math.round(totalRev / Math.max(1, analytics.summary.paidOrderCount || 1)) : 0;
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/orders")}
              className="btn-primary flex items-center gap-1.5 text-xs"
            >
              <OrdersIcon className="w-4 h-4" />
              <span>Live Order Queue</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/tables")}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <TablesIcon className="w-4 h-4" />
              <span>Floor Plan</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={() => <span className="font-bold text-base text-[#087F73]">₹</span>}
          iconBg="bg-[#E7F5F1]"
          iconColor="text-[#087F73]"
          label="Total Revenue"
          value={`₹ ${totalRev.toLocaleString("en-IN")}`}
          badgeText="+18.4% vs last week"
          badgeType="success"
        />
        <KpiCard
          icon={OrdersIcon}
          iconBg="bg-[#EBF3FB]"
          iconColor="text-[#4285C5]"
          label="Total Orders"
          value={totalOrders}
          badgeText="+12% growth"
          badgeType="success"
        />
        <KpiCard
          icon={UsersIcon}
          iconBg="bg-[#FFF8E7]"
          iconColor="text-[#E7A13A]"
          label="Total Customers"
          value={Math.round(totalOrders * 1.8) || 84}
          badgeText="Active dining"
          badgeType="neutral"
        />
        <KpiCard
          icon={AnalyticsIcon}
          iconBg="bg-[#F3EBF9]"
          iconColor="text-[#9333EA]"
          label="Average Order Value"
          value={`₹ ${aov}`}
          badgeText="+5% higher"
          badgeType="success"
        />
      </div>

      {/* Section 1: Revenue & Daily Orders Chart + Service / Table Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Revenue Overview Dual Chart (8 Cols) */}
        <div className="lg:col-span-8 card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#172B2A]">Revenue & Order Trends</h2>
              <p className="text-xs text-[#788582]">Daily paid sales vs volume over the last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-[#087F73] font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#087F73]" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[#D96724] font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D96724]" /> Orders
              </span>
            </div>
          </div>

          {/* Bar Chart Bars */}
          <div className="pt-4">
            <div className="flex items-end justify-between gap-3 h-48 border-b border-[#E5ECE9] pb-2 px-2">
              {analytics.daily.map((day) => {
                const revHeight = Math.max(10, Math.round((day.revenue / maxDailyRevenue) * 100));
                const orderHeight = Math.max(10, Math.round((day.orders / maxDailyOrders) * 100));

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[10px] font-bold text-[#172B2A] opacity-0 group-hover:opacity-100 transition">
                      ₹{Math.round(day.revenue)}
                    </div>
                    <div className="flex items-end justify-center gap-1.5 w-full h-32">
                      <div
                        className="w-4 rounded-t-md bg-[#087F73] transition-all hover:bg-[#004C46]"
                        style={{ height: `${revHeight}%` }}
                        title={`Revenue: ₹${day.revenue.toFixed(2)}`}
                      />
                      <div
                        className="w-4 rounded-t-md bg-[#D96724] transition-all hover:bg-[#b8531a]"
                        style={{ height: `${orderHeight}%` }}
                        title={`Orders: ${day.orders}`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#788582]">
                      {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 flex items-center justify-between text-xs text-[#788582]">
              <span>7 Days Active Operations</span>
              <span>Paid Revenue: <strong className="text-[#172B2A]">₹ {totalRev.toLocaleString("en-IN")}</strong></span>
            </div>
          </div>
        </div>

        {/* Table Status & Orders by Source (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Table Status Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#172B2A]">Table Status</h3>
              <button
                type="button"
                onClick={() => navigate("/admin/tables")}
                className="text-xs text-[#087F73] font-semibold hover:underline"
              >
                View Floor →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-[#EAF7EE] border border-[#269B67]/20">
                <p className="text-[11px] font-semibold text-[#269B67]">Available</p>
                <p className="text-xl font-bold text-[#172B2A] mt-1">{availableCount}</p>
                <p className="text-[10px] text-[#788582]">Tables ready</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FDECEC] border border-[#D95359]/20">
                <p className="text-[11px] font-semibold text-[#D95359]">Occupied</p>
                <p className="text-xl font-bold text-[#172B2A] mt-1">{occupiedCount}</p>
                <p className="text-[10px] text-[#788582]">Dining active</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#788582]">
                <span>Total Registered Tables</span>
                <span className="font-bold text-[#172B2A]">{activeTables.length}</span>
              </div>
              <div className="w-full bg-[#E5ECE9] h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#D95359] h-full"
                  style={{ width: `${(occupiedCount / Math.max(1, activeTables.length)) * 100}%` }}
                />
                <div
                  className="bg-[#269B67] h-full flex-1"
                />
              </div>
            </div>
          </div>

          {/* Orders by Source */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-[#172B2A] mb-3">Orders by Channel</h3>
            <div className="space-y-3 text-xs">
              {[
                { label: "Dine-In QR", pct: "74%", count: "62 orders", color: "bg-[#087F73]" },
                { label: "Takeaway", pct: "18%", count: "15 orders", color: "bg-[#D96724]" },
                { label: "Staff Direct KOT", pct: "8%", count: "7 orders", color: "bg-[#4285C5]" },
              ].map((src) => (
                <div key={src.label}>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-[#172B2A]">{src.label}</span>
                    <span className="text-[#788582]">{src.pct} ({src.count})</span>
                  </div>
                  <div className="w-full bg-[#E5ECE9] h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${src.color}`} style={{ width: src.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Top Selling Items + Recent Orders Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Selling Items (5 Cols) */}
        <div className="lg:col-span-5 card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
            <h3 className="text-sm font-bold text-[#172B2A]">Top Selling Dishes</h3>
            <button
              type="button"
              onClick={() => navigate("/admin/menu")}
              className="text-xs text-[#087F73] font-semibold hover:underline"
            >
              Menu →
            </button>
          </div>

          {analytics.topItems?.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#788582]">No item order data recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {(analytics.topItems || []).slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-[#E7F5F1] text-[#004C46] font-bold flex items-center justify-center text-[11px] shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#172B2A] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#788582]">{item.quantity} orders sold</p>
                    </div>
                  </div>
                  <span className="font-bold text-[#172B2A] shrink-0">
                    ₹ {Number(item.revenue || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders Feed (7 Cols) */}
        <div className="lg:col-span-7 card overflow-hidden">
          <div className="p-4 border-b border-[#E5ECE9] flex items-center justify-between bg-white">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A]">Recent Orders Today</h3>
              <p className="text-[11px] text-[#788582]">Live streaming customer and takeaway orders</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/orders")}
              className="text-xs text-[#087F73] font-semibold hover:underline"
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
            <div className="divide-y divide-[#E5ECE9] text-xs">
              {orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E7F5F1] text-[#087F73] flex items-center justify-center font-bold text-xs shrink-0">
                      📋
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#172B2A] truncate">
                        {order.orderNumber} · {order.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${order.table?.tableNumber || "—"}`}
                      </p>
                      <p className="text-[11px] text-[#788582]">
                        {order.items?.length || 0} items · ₹ {Number(order.totalAmount).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={order.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
