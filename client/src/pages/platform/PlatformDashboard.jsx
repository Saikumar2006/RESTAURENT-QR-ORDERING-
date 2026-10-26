import React, { useEffect, useState } from "react";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import platformApi from "../../services/platformApi";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";
import "./platform-dashboard.css";

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-charcoal/50 mb-1">{label}</p>
      <p className="text-2xl font-display">{value}</p>
      {sub && <p className="text-xs text-charcoal/40 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PlatformDashboard() {
  const { admin, logout } = usePlatformAuth();
  const [overview, setOverview] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([platformApi.get("/overview"), platformApi.get("/restaurants")])
      .then(([o, r]) => {
        if (active) {
          setOverview(o);
          setRestaurants(r);
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  if (loading && (!overview || !restaurants)) return <Spinner label="Loading platform data..." />;
  if (error && (!overview || !restaurants)) return <main className="min-h-screen px-6 py-16"><div className="mx-auto max-w-lg"><ErrorBanner message={error} /><button className="btn-primary" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div></main>;
  if (!overview || !restaurants) return <Spinner label="Loading platform data..." />;

  const sorted = [...restaurants].sort((a, b) => {
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "orders") return b.orderCount - a.orderCount;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const filtered = sorted.filter((restaurant) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || `${restaurant.name} ${restaurant.slug} ${restaurant.cuisineType || ""}`.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "ALL" || restaurant.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="platform-dashboard min-h-screen bg-cream/40 pb-16">
      <header className="bg-charcoal text-cream px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-marigold text-xs uppercase tracking-widest mb-1">Svaadya · Super Admin</p>
          <h1 className="font-display text-2xl">Platform overview</h1>
          <p className="mt-1 text-xs text-cream/50">Cross-restaurant operations and account activity</p>
        </div>
        <div className="text-right">
          <p className="text-sm">{admin?.name}</p>
          <button className="text-xs text-cream/70 underline underline-offset-4" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && <div className="mb-5"><ErrorBanner message={`Refresh failed: ${error}`} /></div>}
        {/* Top-line stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Restaurants" value={overview.totalRestaurants} sub={`${overview.activeRestaurants} active · ${overview.suspendedRestaurants} suspended`} />
          <StatCard label="Open right now" value={overview.openNowCount} sub={`${overview.closedNowCount} closed`} />
          <StatCard label="Total users" value={overview.totalUsers} sub={`${overview.usersByRole.ADMIN} admins · ${overview.usersByRole.STAFF} staff`} />
          <StatCard label="Orders (all time)" value={overview.totalOrders} sub={`${overview.ordersToday} today`} />
          <StatCard label="Revenue (all time)" value={`₹${Number(overview.totalRevenue).toLocaleString("en-IN")}`} sub="from paid orders" />
          <StatCard label="Revenue (today)" value={`₹${Number(overview.revenueToday).toLocaleString("en-IN")}`} />
        </div>

        {/* What kind of restaurants */}
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-sm mb-3">Restaurants by type</h2>
          {overview.restaurantsByCuisine.length === 0 ? (
            <p className="text-xs text-charcoal/50">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {overview.restaurantsByCuisine.map((g) => {
                const pct = Math.round((g.count / overview.totalRestaurants) * 100);
                return (
                  <div key={g.cuisineType}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{g.cuisineType}</span>
                      <span className="text-charcoal/50">{g.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-charcoal/10 rounded-full overflow-hidden">
                      <div className="h-full bg-clove rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Full restaurant list */}
        <div className="card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="font-semibold text-base">Restaurant accounts</h2><p className="mt-1 text-xs text-charcoal/50">Showing {filtered.length} of {restaurants.length}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="platform-restaurant-search">Search restaurants</label>
              <input id="platform-restaurant-search" className="input w-full text-xs sm:w-48" type="search" placeholder="Search name, slug or type" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="sr-only" htmlFor="platform-status-filter">Filter account status</label>
              <select id="platform-status-filter" className="input w-full text-xs py-1.5 sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All accounts</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
              </select>
              <label className="sr-only" htmlFor="platform-sort">Sort restaurants</label>
              <select id="platform-sort" className="input w-full text-xs py-1.5 sm:w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="createdAt">Newest first</option>
              <option value="revenue">Highest revenue</option>
              <option value="orders">Most orders</option>
              <option value="name">Name (A–Z)</option>
              </select>
              <button className="btn-secondary whitespace-nowrap text-xs" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}>{loading ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-charcoal/40 border-b border-charcoal/10">
                  <th className="px-5 py-2 font-medium">Restaurant</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium text-right">Staff</th>
                  <th className="px-2 py-2 font-medium text-right">Tables</th>
                  <th className="px-2 py-2 font-medium text-right">Menu items</th>
                  <th className="px-2 py-2 font-medium text-right">Orders</th>
                  <th className="px-5 py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-charcoal/5">
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-charcoal/40">/{r.slug}</p>
                    </td>
                    <td className="px-2 py-2.5 text-charcoal/60">{r.cuisineType || "—"}</td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1 ${r.status === "SUSPENDED" ? "text-red-600" : r.isOpenNow ? "text-emerald-600" : "text-charcoal/40"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {r.status === "SUSPENDED" ? "Suspended" : r.isOpenNow ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">{r.staffCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.tableCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.menuItemCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.orderCount}</td>
                    <td className="px-5 py-2.5 text-right font-medium">₹{Number(r.totalRevenue).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td className="px-5 py-8 text-center text-charcoal/50" colSpan={8}>No restaurant accounts match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
