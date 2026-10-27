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
  const canViewRestaurants = admin?.permissions?.includes("platform.restaurants.view");
  const canViewFinance = admin?.permissions?.includes("platform.finance.view");
  const canManageAdmins = admin?.permissions?.includes("platform.admins.manage");
  const canManageRestaurants = admin?.permissions?.includes("platform.restaurants.manage");
  const [overview, setOverview] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);
  const [reissueTarget, setReissueTarget] = useState(null);
  const [reissueReason, setReissueReason] = useState("");
  const [reissueError, setReissueError] = useState(null);
  const [reissueResult, setReissueResult] = useState(null);
  const [reissuingInvite, setReissuingInvite] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ restaurantName: "", cuisineType: "", ownerName: "", ownerEmail: "", planKey: "BASIC", reason: "" });

  async function copyInviteLink(url) {
    setInviteCopied(false);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
    } catch {
      setCopyError("Clipboard access is unavailable. Select the link field and copy it manually.");
    }
  }

  async function createRestaurant(event) {
    event.preventDefault();
    setCreatingRestaurant(true);
    setCreateError(null);
    setCreateResult(null);
    setInviteCopied(false);
    setCopyError(null);
    try {
      const result = await platformApi.post("/restaurants", newRestaurant);
      setCreateResult(result);
      setNewRestaurant({ restaurantName: "", cuisineType: "", ownerName: "", ownerEmail: "", planKey: "BASIC", reason: "" });
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreatingRestaurant(false);
    }
  }

  async function reissueOwnerInvite(event) {
    event.preventDefault();
    setReissuingInvite(true);
    setReissueError(null);
    setReissueResult(null);
    try {
      setReissueResult(await platformApi.post(`/restaurants/${reissueTarget.id}/invitation`, { reason: reissueReason }));
      setReissueReason("");
    } catch (err) {
      setReissueError(err.message);
    } finally {
      setReissuingInvite(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([platformApi.get("/overview"), canViewRestaurants ? platformApi.get("/restaurants") : Promise.resolve([])])
      .then(([o, r]) => {
        if (active) {
          setOverview(o);
          setRestaurants(r);
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, canViewRestaurants]);

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
          <p className="text-marigold text-xs uppercase tracking-widest mb-1">Svaadya · {admin?.role?.replaceAll("_", " ") || "Platform"}</p>
          <h1 className="font-display text-2xl">Platform overview</h1>
          <p className="mt-1 text-xs text-cream/50">Cross-restaurant operations and account activity</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          {canManageAdmins && <a className="text-xs text-cream/75 underline underline-offset-4" href="/platform/access">Platform access</a>}
          <div><p className="text-sm">{admin?.name}</p><button className="text-xs text-cream/70 underline underline-offset-4" onClick={logout}>Sign out</button></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && <div className="mb-5"><ErrorBanner message={`Refresh failed: ${error}`} /></div>}
        {/* Top-line stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {canViewRestaurants && <>
          <StatCard label="Restaurants" value={overview.totalRestaurants} sub={`${overview.activeRestaurants} active · ${overview.suspendedRestaurants} suspended`} />
          <StatCard label="Open right now" value={overview.openNowCount} sub={`${overview.closedNowCount} closed`} />
          <StatCard label="Total users" value={overview.totalUsers} sub={`${overview.usersByRole.ADMIN} admins · ${overview.usersByRole.STAFF} staff`} />
          <StatCard label="Orders (all time)" value={overview.totalOrders} sub={`${overview.ordersToday} today`} />
          </>}
          {canViewFinance && <StatCard label="Food order sales (all time)" value={`₹${Number(overview.totalRevenue || 0).toLocaleString("en-IN")}`} sub="paid restaurant orders; excludes subscriptions" />}
          {canViewFinance && <StatCard label="Food order sales (today)" value={`₹${Number(overview.revenueToday || 0).toLocaleString("en-IN")}`} />}
        </div>

        {/* What kind of restaurants */}
        {canViewRestaurants && <div className="card p-5 mb-6">
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
        </div>}

        {/* Full restaurant list */}
        {canViewRestaurants && <div className="card p-5">
          {canManageRestaurants && <div className="mb-5 flex flex-col gap-3 border-b border-charcoal/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-base">Platform-created account</h2><p className="mt-1 text-xs text-charcoal/50">Create an account without checkout. The owner sets a password from a one-time invite.</p></div>
            <button className="btn-primary whitespace-nowrap text-xs" type="button" onClick={() => { setShowCreateForm((open) => !open); setCreateError(null); }}> {showCreateForm ? "Close form" : "Create restaurant"}</button>
          </div>}
          {canManageRestaurants && showCreateForm && <form className="mb-5 grid gap-3 rounded border border-charcoal/10 bg-cream/30 p-4 md:grid-cols-2" onSubmit={createRestaurant}>
            {createError && <div className="md:col-span-2" role="alert"><ErrorBanner message={createError} /></div>}
            <label className="grid gap-1 text-xs">Restaurant name<input className="input" required minLength={2} maxLength={100} value={newRestaurant.restaurantName} onChange={(e) => setNewRestaurant({ ...newRestaurant, restaurantName: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Cuisine type (optional)<input className="input" maxLength={60} value={newRestaurant.cuisineType} onChange={(e) => setNewRestaurant({ ...newRestaurant, cuisineType: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Owner name<input className="input" required minLength={2} maxLength={100} value={newRestaurant.ownerName} onChange={(e) => setNewRestaurant({ ...newRestaurant, ownerName: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Owner email<input className="input" required type="email" maxLength={254} autoComplete="email" value={newRestaurant.ownerEmail} onChange={(e) => setNewRestaurant({ ...newRestaurant, ownerEmail: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Assigned plan<select className="input" value={newRestaurant.planKey} onChange={(e) => setNewRestaurant({ ...newRestaurant, planKey: e.target.value })}><option value="BASIC">Basic</option><option value="STANDARD">Standard</option><option value="PREMIUM">Premium</option></select></label>
            <label className="grid gap-1 text-xs md:col-span-2">Required audit reason<textarea className="input min-h-20 py-2" required minLength={8} maxLength={500} value={newRestaurant.reason} onChange={(e) => setNewRestaurant({ ...newRestaurant, reason: e.target.value })} placeholder="Why is this restaurant receiving a platform-created account?" /></label>
            <p className="text-xs leading-5 text-charcoal/55 md:col-span-2">The account stays suspended until its owner activates the invite; the restaurant remains closed until the owner finishes setup and opens it. Subscription state is a non-expiring platform grant with no payment recorded. Share the setup link with the named owner through an approved channel.</p>
            <div className="md:col-span-2"><button className="btn-primary text-xs" type="submit" disabled={creatingRestaurant}>{creatingRestaurant ? "Creating account…" : "Create account and invite owner"}</button></div>
          </form>}
          {createResult && <section className="mb-5 rounded border border-emerald-700/20 bg-emerald-50 p-4" aria-live="polite">
            <h3 className="text-sm font-semibold text-emerald-900">Account created; owner setup is pending</h3>
            <p className="mt-1 text-xs leading-5 text-emerald-900/75">This one-time link expires {new Date(createResult.invite.expiresAt).toLocaleString()}. It is shown only now and is not emailed.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input min-w-0 flex-1 text-xs" aria-label="One-time owner activation link" readOnly value={createResult.invite.setupUrl} onFocus={(e) => e.target.select()} /><button className="btn-secondary whitespace-nowrap text-xs" type="button" onClick={() => copyInviteLink(createResult.invite.setupUrl)}>{inviteCopied ? "Copied" : "Copy invite link"}</button></div>
            {copyError && <p className="mt-2 text-xs text-emerald-900/75" aria-live="polite">{copyError}</p>}
            <p className="mt-2 text-xs text-emerald-900/75">Plan: {createResult.subscription.planKey} · Subscription: {createResult.subscription.status} · Account: {createResult.restaurant.status}</p>
          </section>}
          {reissueTarget && <form className="mb-5 grid gap-3 rounded border border-amber-700/20 bg-amber-50 p-4 md:grid-cols-2" onSubmit={reissueOwnerInvite}>
            <div className="md:col-span-2"><h3 className="text-sm font-semibold">Issue a new owner invite for {reissueTarget.name}</h3><p className="mt-1 text-xs text-charcoal/60">The previous setup link will stop working. Add a reason to the platform audit record.</p></div>
            {reissueError && <div className="md:col-span-2" role="alert"><ErrorBanner message={reissueError} /></div>}
            <label className="grid gap-1 text-xs md:col-span-2">Required audit reason<textarea className="input min-h-20 py-2" required minLength={8} maxLength={500} value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} /></label>
            <div className="flex gap-2 md:col-span-2"><button className="btn-primary text-xs" type="submit" disabled={reissuingInvite}>{reissuingInvite ? "Issuing link…" : "Issue new invite"}</button><button className="btn-secondary text-xs" type="button" onClick={() => { setReissueTarget(null); setReissueResult(null); }}>Cancel</button></div>
          </form>}
          {reissueResult && <section className="mb-5 rounded border border-amber-700/20 bg-amber-50 p-4" aria-live="polite">
            <h3 className="text-sm font-semibold">New one-time invite issued</h3>
            <p className="mt-1 text-xs leading-5 text-charcoal/65">The previous link has been invalidated. This link expires {new Date(reissueResult.invite.expiresAt).toLocaleString()} and is not emailed.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input min-w-0 flex-1 text-xs" aria-label="New owner activation link" readOnly value={reissueResult.invite.setupUrl} onFocus={(e) => e.target.select()} /><button className="btn-secondary whitespace-nowrap text-xs" type="button" onClick={() => copyInviteLink(reissueResult.invite.setupUrl)}>{inviteCopied ? "Copied" : "Copy invite link"}</button></div>
            {copyError && <p className="mt-2 text-xs text-charcoal/70" aria-live="polite">{copyError}</p>}
          </section>}
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
                  <th className="px-2 py-2 font-medium">Owner setup</th>
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
                    <td className="px-2 py-2.5">{r.ownerSetupPending ? <div className="flex items-center gap-2"><span className="text-amber-700">Pending</span>{canManageRestaurants && <button className="text-xs text-clove underline underline-offset-2" type="button" onClick={() => { setReissueTarget(r); setReissueResult(null); setReissueReason(""); setReissueError(null); setInviteCopied(false); setCopyError(null); }}>New invite</button>}</div> : <span className="text-charcoal/45">—</span>}</td>
                    <td className="px-2 py-2.5 text-right">{r.staffCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.tableCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.menuItemCount}</td>
                    <td className="px-2 py-2.5 text-right">{r.orderCount}</td>
                    <td className="px-5 py-2.5 text-right font-medium">₹{Number(r.totalRevenue).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td className="px-5 py-8 text-center text-charcoal/50" colSpan={9}>No restaurant accounts match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
      </div>
    </main>
  );
}
