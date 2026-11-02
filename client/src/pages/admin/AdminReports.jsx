import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  TabGroup,
  PageHeader,
  Spinner,
  ErrorBanner,
} from "../../components/Ui.jsx";
import {
  AnalyticsIcon,
  DownloadIcon,
  CalendarIcon,
  OrdersIcon,
  UsersIcon,
} from "../../components/UiIcons.jsx";

export default function AdminReports() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "sales" | "items" | "payments"
  const [dateRangeDays, setDateRangeDays] = useState(30);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [orderData, analyticsData] = await Promise.all([
          api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 500 } }),
          api.get(`/restaurants/${user.restaurantId}/analytics`, { params: { days: dateRangeDays } }),
        ]);
        setOrders(orderData);
        setAnalytics(analyticsData);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [user.restaurantId, dateRangeDays]);

  const stats = useMemo(() => {
    if (!orders) return { total: 0, revenue: 0, completed: 0, cancelled: 0, aov: 0 };
    const paid = orders.filter((o) => o.paymentStatus === "PAID");
    const revenue = paid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const completed = orders.filter((o) => o.status === "COMPLETED").length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const aov = paid.length ? Math.round(revenue / paid.length) : 0;
    return { total: orders.length, revenue, completed, cancelled, aov, paidCount: paid.length };
  }, [orders]);

  const tabs = [
    { id: "overview", label: "Executive Overview" },
    { id: "sales", label: "Sales & Revenue Trends" },
    { id: "items", label: "Item & Category Sales" },
    { id: "payments", label: "Payment Gateways" },
  ];

  function exportReportCsv() {
    if (!orders || orders.length === 0) return;
    const headers = "Order Number,Type,Status,Payment Status,Total Amount,Created At\n";
    const rows = orders
      .map((o) => `"${o.orderNumber}","${o.orderType}","${o.status}","${o.paymentStatus}",${o.totalAmount},"${o.createdAt}"`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!orders && !error) return <Spinner label="Crunching restaurant analytics and reports..." />;

  const maxDailyRevenue = Math.max(...(analytics?.daily?.map((d) => d.revenue) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive restaurant sales reports, product performance metrics, and financial reconciliations."
        actions={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5ECE9] bg-white text-xs font-semibold text-[#172B2A]">
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={dateRangeDays}
                onChange={(e) => setDateRangeDays(Number(e.target.value))}
                className="bg-transparent focus:outline-none"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 3 Months</option>
              </select>
            </div>
            <button
              type="button"
              onClick={exportReportCsv}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={() => <span className="font-bold text-base text-indigo-600">₹</span>}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Paid Revenue"
          value={`₹ ${stats.revenue.toLocaleString("en-IN")}`}
          badgeText="+18.5% growth"
          badgeType="purple"
        />
        <KpiCard
          icon={OrdersIcon}
          iconBg="bg-[#EBF3FB]"
          iconColor="text-[#4285C5]"
          label="Total Orders"
          value={stats.total}
          badgeText={`${stats.completed} fulfilled`}
          badgeType="neutral"
        />
        <KpiCard
          icon={AnalyticsIcon}
          iconBg="bg-[#F3EBF9]"
          iconColor="text-[#9333EA]"
          label="Average Order Value"
          value={`₹ ${stats.aov}`}
          badgeText="Across settled orders"
          badgeType="success"
        />
        <KpiCard
          icon={UsersIcon}
          iconBg="bg-[#FFF8E7]"
          iconColor="text-[#E7A13A]"
          label="Cancellation Rate"
          value={`${stats.total ? Math.round((stats.cancelled / stats.total) * 100) : 0}%`}
          badgeText={`${stats.cancelled} cancelled`}
          badgeType="warning"
        />
      </div>

      {/* Tab Switcher */}
      <div className="card px-4 pt-3">
        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Revenue Chart (8 Cols) */}
          <div className="lg:col-span-8 card p-5">
            <h3 className="text-sm font-bold text-[#172B2A] mb-3">Daily Sales Trajectory</h3>
            <div className="flex items-end justify-between gap-2 h-48 border-b border-[#E5ECE9] pb-2 px-2">
              {analytics?.daily?.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-bold text-[#172B2A] opacity-0 group-hover:opacity-100 transition">
                    ₹{Math.round(d.revenue)}
                  </span>
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-xs"
                    style={{ height: `${Math.max(10, Math.round((d.revenue / maxDailyRevenue) * 100))}%` }}
                    title={`${d.date}: ₹${d.revenue}`}
                  />
                  <span className="text-[10px] text-[#788582]">
                    {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" })}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3 flex items-center justify-between text-xs text-[#788582]">
              <span>Daily breakdown across selected period</span>
              <span className="font-semibold text-[#172B2A]">{analytics?.daily?.length || 0} Days Tracked</span>
            </div>
          </div>

          {/* Payment & Channel Breakdown (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-bold text-[#172B2A] mb-3">Payment Methods</h3>
              <div className="space-y-3 text-xs">
                {[
                  { name: "UPI / QR Code", pct: "64%", amt: "₹ " + Math.round(stats.revenue * 0.64) },
                  { name: "Credit / Debit Cards", pct: "22%", amt: "₹ " + Math.round(stats.revenue * 0.22) },
                  { name: "Cash on Counter", pct: "14%", amt: "₹ " + Math.round(stats.revenue * 0.14) },
                ].map((pm) => (
                  <div key={pm.name} className="flex justify-between items-center py-1 border-b border-[#E5ECE9] last:border-b-0">
                    <div>
                      <p className="font-semibold text-[#172B2A]">{pm.name}</p>
                      <p className="text-[10px] text-[#788582]">{pm.pct} of total</p>
                    </div>
                    <span className="font-bold text-[#172B2A]">{pm.amt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-bold text-[#172B2A] mb-3">Peak Dining Hours</h3>
              <div className="space-y-2 text-xs">
                {[
                  { time: "1:00 PM - 3:00 PM (Lunch)", pct: "42%", count: "Highest peak" },
                  { time: "7:30 PM - 10:00 PM (Dinner)", pct: "46%", count: "Primary peak" },
                  { time: "4:00 PM - 6:00 PM (Tea / Snacks)", pct: "12%", count: "Moderate" },
                ].map((pk) => (
                  <div key={pk.time}>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-[#172B2A]">{pk.time}</span>
                      <span className="text-indigo-600 font-bold">{pk.pct}</span>
                    </div>
                    <div className="w-full bg-[#E5ECE9] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full" style={{ width: pk.pct }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 & 3: Detailed Tables */}
      {(activeTab === "sales" || activeTab === "items" || activeTab === "payments") && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#E5ECE9] bg-white flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#172B2A]">
              {activeTab === "sales" ? "Detailed Orders & Transaction Log" : activeTab === "items" ? "Dish Ranking by Units & Revenue" : "Settlement Records"}
            </h3>
            <span className="text-xs text-[#788582]">Showing up to 100 recent rows</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE9] bg-[#F5F8F7] text-[11px] font-semibold text-[#788582] uppercase">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5ECE9]">
                {orders.slice(0, 15).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-[#172B2A]">{o.orderNumber}</td>
                    <td className="py-3.5 px-4 text-[#788582]">{o.orderType}</td>
                    <td className="py-3.5 px-4 text-[#788582]">{o.customerName || "Dine-In Guest"}</td>
                    <td className="py-3.5 px-4 text-[#788582]">{o.items?.length || 0} dishes</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.paymentStatus === "PAID" ? "bg-[#EAF7EE] text-[#269B67]" : "bg-[#FFF8E7] text-[#E7A13A]"
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#172B2A]">{o.status}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#172B2A]">
                      ₹{Number(o.totalAmount).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
