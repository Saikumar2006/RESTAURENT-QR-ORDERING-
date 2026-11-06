import React from "react";

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function PlatformAnalyticsTab({ overview }) {
  const mrr = overview?.monthlyRecurringRevenue || 0;
  const arr = mrr * 12;
  const totalOrders = overview?.totalOrders || 0;
  const totalRev = overview?.totalRevenue || 0;
  const planDist = overview?.planDistribution || [];
  const cuisineDist = overview?.restaurantsByCuisine || [];
  const regTrends = overview?.restaurantRegistrations || [];

  const maxTrend = Math.max(...regTrends.map((t) => t.count || 0), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Platform Growth & Revenue Analytics</h2>
        <p className="text-xs text-slate-500 mt-1">
          Macro KPIs, cohort trends, subscription plan adoption, and dining market distribution across the Svaadya platform.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Run Rate</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{money(mrr)}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Recurring SaaS Revenue</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Annual Run Rate</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{money(arr)}</div>
          <span className="text-[11px] text-indigo-600 font-medium">Annualized Ecosystem Revenue</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Dining GMV</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{money(totalRev)}</div>
          <span className="text-[11px] text-slate-500 font-medium">Across all restaurant tables</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Orders Processed</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalOrders.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500 font-medium">Dine-in and takeaway orders</span>
        </div>
      </div>

      {/* Registration Trend Chart (Pure CSS Bar Chart) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Restaurant Growth Trend (Last 12 Months)</h3>
            <p className="text-[11px] text-slate-500">Monthly new restaurant onboarding velocity</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-teal-50 text-teal-800 rounded-full border border-teal-200">
            Realtime DB Aggregation
          </span>
        </div>

        <div className="h-48 flex items-end gap-2 sm:gap-4 pt-6 border-b border-slate-200 pb-2">
          {regTrends.map((t, idx) => {
            const heightPct = Math.round(((t.count || 0) / maxTrend) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition">
                  {t.count}
                </span>
                <div
                  className="w-full bg-teal-600 hover:bg-teal-500 rounded-t transition-all duration-300"
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                  title={`${t.month}: ${t.count} registrations`}
                />
                <span className="text-[9px] text-slate-400 font-mono mt-1">{t.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution Grids: Plan Adoption & Cuisine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Plan Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Subscription Plan Mix</h3>
          <div className="space-y-3">
            {planDist.length === 0 ? (
              <p className="text-xs text-slate-400">No active subscriptions yet.</p>
            ) : (
              planDist.map((p) => (
                <div key={p.planKey} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{p.planKey}</span>
                    <span className="font-bold text-slate-900">{p.count} restaurant(s)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${Math.min(100, p.count * 25)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cuisine Types */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Cuisine Diversity</h3>
          <div className="space-y-2">
            {cuisineDist.length === 0 ? (
              <p className="text-xs text-slate-400">No cuisine data configured.</p>
            ) : (
              cuisineDist.slice(0, 6).map((c) => (
                <div key={c.cuisineType} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                  <span className="font-medium text-slate-700">{c.cuisineType}</span>
                  <span className="font-bold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800">
                    {c.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
