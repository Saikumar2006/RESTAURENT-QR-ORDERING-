import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import platformApi from "../../services/platformApi";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";
import PlatformAnalyticsTab from "./modules/PlatformAnalyticsTab.jsx";
import PlatformUsersTab from "./modules/PlatformUsersTab.jsx";
import PlatformBillingTab from "./modules/PlatformBillingTab.jsx";
import PlatformSupportTab from "./modules/PlatformSupportTab.jsx";
import PlatformHealthTab from "./modules/PlatformHealthTab.jsx";
import PlatformSettingsTab from "./modules/PlatformSettingsTab.jsx";
import PlatformOnboardingTab from "./modules/PlatformOnboardingTab.jsx";
import PlatformRolesTab from "./modules/PlatformRolesTab.jsx";
import "./platform-dashboard.css";

const PLATFORM_VIEWS = [
  "overview",
  "analytics",
  "restaurants",
  "users",
  "onboarding",
  "onboardings",
  "subscriptions",
  "packages",
  "billing",
  "roles",
  "support",
  "communications",
  "security",
  "audit",
  "health",
  "settings",
];

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
  const { admin } = usePlatformAuth();
  const [searchParams] = useSearchParams();
  const canViewRestaurants = admin?.permissions?.includes("platform.restaurants.view");
  const canViewFinance = admin?.permissions?.includes("platform.finance.view");
  const canManageAdmins = admin?.permissions?.includes("platform.admins.manage");
  const canManageRestaurants = admin?.permissions?.includes("platform.restaurants.manage");
  const canViewAudit = admin?.permissions?.includes("platform.audit.view");

  const requestedView = searchParams.get("view");
  const activeTab = PLATFORM_VIEWS.includes(requestedView) ? requestedView : "overview";

  // Existing overview & restaurants state
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
  const [newRestaurant, setNewRestaurant] = useState({ restaurantName: "", cuisineType: "", ownerName: "", ownerEmail: "", planKey: "STARTER", reason: "" });

  // Inspection Drawer & Status Toggle
  const [inspectingRestaurant, setInspectingRestaurant] = useState(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState(null);

  async function openRestaurantDetails(restaurantId) {
    setLoadingInspection(true);
    try {
      const data = await platformApi.get(`/restaurants/${restaurantId}`);
      setInspectingRestaurant(data);
    } catch (err) {
      setError(err.message || "Failed to load restaurant details");
    } finally {
      setLoadingInspection(false);
    }
  }

  async function handleToggleRestaurantStatus(restaurant) {
    const nextStatus = restaurant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const reason = prompt(`Enter audit reason to ${nextStatus.toLowerCase()} ${restaurant.name}:`, "Administrative governance review");
    if (!reason) return;
    setTogglingStatusId(restaurant.id);
    try {
      await platformApi.put(`/restaurants/${restaurant.id}/status`, { status: nextStatus, reason });
      setRestaurants((prev) => (prev || []).map((r) => r.id === restaurant.id ? { ...r, status: nextStatus } : r));
      if (inspectingRestaurant?.id === restaurant.id) {
        setInspectingRestaurant((prev) => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err) {
      setError(err.message || "Failed to update restaurant status");
    } finally {
      setTogglingStatusId(null);
    }
  }

  // Packages & Pricing state
  const [packagesData, setPackagesData] = useState(null);
  const [editPrices, setEditPrices] = useState({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState(null);
  const [pricingError, setPricingError] = useState(null);

  // Subscriptions state
  const [subscriptionsList, setSubscriptionsList] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subFilter, setSubFilter] = useState("ALL");

  // Pending Onboardings state
  const [pendingOnboardingsList, setPendingOnboardingsList] = useState([]);
  const [loadingOnboardings, setLoadingOnboardings] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditError, setAuditError] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Communications state
  const [commStatus, setCommStatus] = useState(null);
  const [commStats, setCommStats] = useState(null);
  const [commTemplates, setCommTemplates] = useState([]);
  const [commLogs, setCommLogs] = useState([]);
  const [commLogsPagination, setCommLogsPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loadingComm, setLoadingComm] = useState(false);
  const [commTestPhone, setCommTestPhone] = useState("");
  const [commTestChannel, setCommTestChannel] = useState("sms");
  const [commTestMessage, setCommTestMessage] = useState("");
  const [commTesting, setCommTesting] = useState(false);
  const [commTestResult, setCommTestResult] = useState(null);
  const [commConnTesting, setCommConnTesting] = useState(false);
  const [commConnResult, setCommConnResult] = useState(null);
  const [commFilterChannel, setCommFilterChannel] = useState("ALL");
  const [commFilterStatus, setCommFilterStatus] = useState("ALL");
  const [commFilterPurpose, setCommFilterPurpose] = useState("ALL");
  const [commSearch, setCommSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState(null);

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
      setNewRestaurant({ restaurantName: "", cuisineType: "", ownerName: "", ownerEmail: "", planKey: "STARTER", reason: "" });
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

  // Load subscriptions
  async function loadSubscriptions() {
    setLoadingSubscriptions(true);
    try {
      const data = await platformApi.get("/subscriptions");
      setSubscriptionsList(data || []);
    } catch (err) {
      console.error("Failed to load subscriptions", err);
    } finally {
      setLoadingSubscriptions(false);
    }
  }

  // Load packages
  async function loadPackages() {
    try {
      const data = await platformApi.get("/packages");
      setPackagesData(data);
      const initialPrices = {};
      (data.plans || []).forEach((p) => {
        initialPrices[p.key] = { ...p.prices };
      });
      setEditPrices(initialPrices);
    } catch (err) {
      console.error("Failed to load packages", err);
    }
  }

  // Load pending onboardings
  async function loadPendingOnboardings() {
    setLoadingOnboardings(true);
    try {
      const data = await platformApi.get("/pending-onboardings");
      setPendingOnboardingsList(data || []);
    } catch (err) {
      console.error("Failed to load pending onboardings", err);
    } finally {
      setLoadingOnboardings(false);
    }
  }

  async function loadAudit(limit = 100) {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      setAuditEntries(await platformApi.get(`/audit?limit=${limit}`) || []);
    } catch (err) {
      setAuditError(err.message);
    } finally {
      setLoadingAudit(false);
    }
  }

  // Save updated package pricing
  async function handleSavePricing(e) {
    e.preventDefault();
    setSavingPrices(true);
    setPricingSuccess(null);
    setPricingError(null);
    try {
      const updated = await platformApi.put("/packages", { prices: editPrices });
      setPackagesData(updated);
      setPricingSuccess("Package pricing updated successfully across the platform!");
    } catch (err) {
      setPricingError(err.message || "Failed to save package pricing.");
    } finally {
      setSavingPrices(false);
    }
  }

  function handleMonthlyPriceChange(planKey, val) {
    const monthly = Math.max(0, parseInt(val, 10) || 0);
    setEditPrices((prev) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        MONTHLY: monthly,
        "3_MONTHS": Math.round(monthly * 3 * 0.95),
        "6_MONTHS": Math.round(monthly * 6 * 0.9),
        YEARLY: Math.round(monthly * 12 * 0.8),
      },
    }));
  }

  async function loadCommunications() {
    setLoadingComm(true);
    try {
      const [status, stats, templates, logsData] = await Promise.all([
        platformApi.get("/communications/status"),
        platformApi.get("/communications/stats"),
        platformApi.get("/communications/templates"),
        platformApi.get(`/communications/logs?page=${commLogsPagination.page}&limit=15&channel=${commFilterChannel}&status=${commFilterStatus}&purpose=${commFilterPurpose}&search=${encodeURIComponent(commSearch)}`),
      ]);
      setCommStatus(status);
      setCommStats(stats);
      setCommTemplates(templates || []);
      setCommLogs(logsData.items || []);
      setCommLogsPagination(logsData.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      console.error("Failed to load communications data:", err.message);
    } finally {
      setLoadingComm(false);
    }
  }

  async function handleTestConnection() {
    setCommConnTesting(true);
    setCommConnResult(null);
    try {
      const res = await platformApi.post("/communications/test-connection");
      setCommConnResult({ success: true, ...res });
    } catch (err) {
      setCommConnResult({ success: false, message: err.message });
    } finally {
      setCommConnTesting(false);
    }
  }

  async function handleSendTestMessage(e) {
    e.preventDefault();
    if (!commTestPhone) return;
    setCommTesting(true);
    setCommTestResult(null);
    try {
      const res = await platformApi.post("/communications/test", {
        phone: commTestPhone,
        channel: commTestChannel,
        message: commTestMessage || undefined,
      });
      setCommTestResult({ success: true, ...res });
      loadCommunications();
    } catch (err) {
      setCommTestResult({ success: false, message: err.message });
    } finally {
      setCommTesting(false);
    }
  }

  async function handleSaveTemplate(e) {
    e.preventDefault();
    if (!editingTemplate) return;
    setSavingTemplate(true);
    setTemplateSuccess(null);
    try {
      const updated = await platformApi.put(`/communications/templates/${editingTemplate.key}`, {
        title: editingTemplate.title,
        body: editingTemplate.body,
        channel: editingTemplate.channel,
        isActive: editingTemplate.isActive,
      });
      setCommTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      setTemplateSuccess(`Template "${editingTemplate.title}" saved successfully.`);
      setEditingTemplate(null);
    } catch (err) {
      setError(err.message || "Failed to update template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      platformApi.get("/overview"),
      canViewRestaurants ? platformApi.get("/restaurants") : Promise.resolve([]),
      platformApi.get("/packages").catch(() => null),
    ])
      .then(([o, r, pkg]) => {
        if (active) {
          setOverview(o);
          setRestaurants(r);
          if (pkg) {
            setPackagesData(pkg);
            const initialPrices = {};
            (pkg.plans || []).forEach((p) => {
              initialPrices[p.key] = { ...p.prices };
            });
            setEditPrices(initialPrices);
          }
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, canViewRestaurants]);

  useEffect(() => {
    if (activeTab === "subscriptions") loadSubscriptions();
    if (activeTab === "packages") loadPackages();
    if (activeTab === "onboardings" || activeTab === "onboarding") loadPendingOnboardings();
    if (activeTab === "communications") loadCommunications();
    if (activeTab === "audit" || activeTab === "security") loadAudit();
    if (activeTab === "overview" && canViewAudit) loadAudit(8);
  }, [activeTab, commLogsPagination.page, commFilterChannel, commFilterStatus, commFilterPurpose]);

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

  const filteredSubs = subscriptionsList.filter((s) => {
    if (subFilter === "ALL") return true;
    return s.status === subFilter;
  });

  // Calculate MRR from active subscriptions
  const activeSubs = subscriptionsList.filter((s) => s.status === "ACTIVE" || s.status === "TRIALING");
  const estimatedMrr = subscriptionsList
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => {
      const perMonth = s.billingPeriod === "YEARLY" ? s.amount / 12 : s.billingPeriod === "6_MONTHS" ? s.amount / 6 : s.billingPeriod === "3_MONTHS" ? s.amount / 3 : s.amount;
      return sum + (perMonth || 0);
    }, 0);

  return (
    <main className="platform-dashboard min-h-screen bg-cream/40 pb-16">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="platform-dashboard-heading">
          <div>
            <p className="section-eyebrow !ml-0">Svaadya · Platform</p>
            <h1>{activeTab === "overview" ? "Executive overview" : ({
              analytics: "Platform Analytics & Business Intelligence",
              restaurants: "Restaurants & operations",
              users: "Cross-Tenant User Directory",
              onboarding: "Restaurant Onboarding Funnel",
              onboardings: "Restaurant Applications",
              subscriptions: "Subscriptions & MRR",
              packages: "Plans & Pricing Management",
              billing: "Financial Transactions & Invoicing",
              roles: "Enterprise Roles & Permission Matrix",
              support: "Operational Support & Ticket Desk",
              communications: "Communications & Twilio Center",
              security: "Security & Audit Trail",
              audit: "Security & Audit Trail",
              health: "System Health & Infrastructure Telemetry",
              settings: "Global Platform Settings & Configuration",
            }[activeTab] || "Platform administration")}</h1>
            <p>Live operational data from the platform database.</p>
          </div>
          <button className="btn-secondary text-xs" type="button" onClick={() => setRefreshKey((key) => key + 1)}>
            Refresh overview
          </button>
        </header>
        {error && <div className="mb-5"><ErrorBanner message={`Refresh failed: ${error}`} /></div>}

        {activeTab === "overview" && (
          <section aria-label="Platform overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {canViewRestaurants && <StatCard label="Total restaurants" value={overview.totalRestaurants} sub={`${overview.activeRestaurants} active`} />}
              {canViewRestaurants && <StatCard label="Pending onboarding" value={overview.pendingOnboardings} sub="Awaiting checkout completion" />}
              {canViewRestaurants && <StatCard label="Suspended restaurants" value={overview.suspendedRestaurants} sub={`${overview.openNowCount} currently open`} />}
              {canViewRestaurants && <StatCard label="Active subscriptions" value={overview.activeSubscriptions} sub={`${overview.trialingSubscriptions} currently trialing`} />}
              {canManageAdmins && <StatCard label="Platform administrators" value={overview.totalPlatformUsers} sub="Provisioned platform accounts" />}
              {canViewFinance && <StatCard label="Monthly recurring revenue" value={`₹${Number(overview.monthlyRecurringRevenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="Normalized active subscription value" />}
              {canViewFinance && <StatCard label="Subscription revenue" value={`₹${Number(overview.subscriptionRevenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="Collected from paid subscription invoices" />}
              {canViewFinance && <StatCard label="Food order sales" value={`₹${Number(overview.totalRevenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="Paid restaurant orders · separate from SaaS revenue" />}
            </div>

            {canViewRestaurants && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,.8fr)]">
                <section className="card p-5">
                  <div className="mb-5">
                    <h2 className="font-semibold text-sm">Restaurant registrations</h2>
                    <p className="mt-1 text-xs text-charcoal/50">Monthly new tenants · last 12 months</p>
                  </div>
                  <div className="platform-chart" role="img" aria-label="Monthly restaurant registrations for the last 12 months">
                    {(overview.restaurantRegistrations || []).map((month) => {
                      const max = Math.max(1, ...(overview.restaurantRegistrations || []).map((entry) => entry.count));
                      return (
                        <div className="platform-chart-column" key={month.month}>
                          <span>{month.count}</span>
                          <div className="platform-chart-track"><i style={{ height: `${Math.max(4, (month.count / max) * 100)}%` }} /></div>
                          <small>{month.month}</small>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="card p-5">
                  <div className="mb-4">
                    <h2 className="font-semibold text-sm">Subscription plan mix</h2>
                    <p className="mt-1 text-xs text-charcoal/50">Active and trial subscriptions</p>
                  </div>
                  {(overview.planDistribution || []).length ? (
                    <div className="space-y-4">
                      {(overview.planDistribution || []).map((plan) => {
                        const total = (overview.planDistribution || []).reduce((sum, entry) => sum + entry.count, 0);
                        const percent = total ? Math.round((plan.count / total) * 100) : 0;
                        return (
                          <div key={plan.planKey}>
                            <div className="mb-1 flex justify-between text-xs"><span>{plan.planKey}</span><span className="text-charcoal/55">{plan.count} · {percent}%</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-charcoal/10"><div className="h-full rounded-full bg-[#147c70]" style={{ width: `${percent}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-charcoal/50">No active subscriptions yet.</p>}
                </section>
              </div>
            )}

            {canViewAudit && (
              <section className="card p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h2 className="font-semibold text-sm">Recent platform activity</h2><p className="mt-1 text-xs text-charcoal/50">Latest administrative audit events</p></div>
                  <button className="btn-secondary text-xs" type="button" onClick={() => loadAudit(8)} disabled={loadingAudit}>Refresh activity</button>
                </div>
                {auditError && <ErrorBanner message={auditError} />}
                <div className="divide-y divide-charcoal/5">
                  {auditEntries.slice(0, 8).map((entry) => (
                    <div className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between" key={entry.id}>
                      <div><span className="font-medium">{entry.actor?.name || "System"}</span><span className="text-charcoal/60"> · {entry.action.replaceAll(".", " ").replaceAll("_", " ")}</span></div>
                      <time className="text-charcoal/45" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                    </div>
                  ))}
                  {!loadingAudit && auditEntries.length === 0 && !auditError && <p className="py-4 text-xs text-charcoal/50">No platform activity recorded yet.</p>}
                </div>
              </section>
            )}
          </section>
        )}

        {/* TAB 1: RESTAURANTS & OPERATIONS */}
        {activeTab === "restaurants" && (
          <>
            {/* Top-line stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {canViewRestaurants && (
                <>
                  <StatCard label="Restaurants" value={overview.totalRestaurants} sub={`${overview.activeRestaurants} active · ${overview.suspendedRestaurants} suspended`} />
                  <StatCard label="Open right now" value={overview.openNowCount} sub={`${overview.closedNowCount} closed`} />
                  <StatCard label="Total users" value={overview.totalUsers} sub={`${overview.usersByRole.ADMIN} admins · ${overview.usersByRole.STAFF} staff`} />
                  <StatCard label="Orders (all time)" value={overview.totalOrders} sub={`${overview.ordersToday} today`} />
                </>
              )}
              {canViewFinance && <StatCard label="Food order sales (all time)" value={`₹${Number(overview.totalRevenue || 0).toLocaleString("en-IN")}`} sub="paid restaurant orders; excludes subscriptions" />}
              {canViewFinance && <StatCard label="Food order sales (today)" value={`₹${Number(overview.revenueToday || 0).toLocaleString("en-IN")}`} />}
            </div>

            {/* Restaurants by type */}
            {canViewRestaurants && (
              <div className="card p-5 mb-6">
                <h2 className="font-semibold text-sm mb-3">Restaurants by cuisine</h2>
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
            )}

            {/* Full restaurant list */}
            {canViewRestaurants && (
              <div className="card p-5">
                {canManageRestaurants && (
                  <div className="mb-5 flex flex-col gap-3 border-b border-charcoal/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-base">Direct Account Provisioning</h2>
                      <p className="mt-1 text-xs text-charcoal/50">Create an account without checkout. The owner sets a password from a one-time invite.</p>
                    </div>
                    <button className="btn-primary whitespace-nowrap text-xs" type="button" onClick={() => { setShowCreateForm((open) => !open); setCreateError(null); }}>
                      {showCreateForm ? "Close form" : "Create restaurant"}
                    </button>
                  </div>
                )}
                {canManageRestaurants && showCreateForm && (
                  <form className="mb-5 grid gap-3 rounded border border-charcoal/10 bg-cream/30 p-4 md:grid-cols-2" onSubmit={createRestaurant}>
                    {createError && <div className="md:col-span-2" role="alert"><ErrorBanner message={createError} /></div>}
                    <label className="grid gap-1 text-xs font-medium">Restaurant name<input className="input" required minLength={2} maxLength={100} value={newRestaurant.restaurantName} onChange={(e) => setNewRestaurant({ ...newRestaurant, restaurantName: e.target.value })} /></label>
                    <label className="grid gap-1 text-xs font-medium">Cuisine type (optional)<input className="input" maxLength={60} value={newRestaurant.cuisineType} onChange={(e) => setNewRestaurant({ ...newRestaurant, cuisineType: e.target.value })} /></label>
                    <label className="grid gap-1 text-xs font-medium">Owner name<input className="input" required minLength={2} maxLength={100} value={newRestaurant.ownerName} onChange={(e) => setNewRestaurant({ ...newRestaurant, ownerName: e.target.value })} /></label>
                    <label className="grid gap-1 text-xs font-medium">Owner email<input className="input" required type="email" maxLength={254} autoComplete="email" value={newRestaurant.ownerEmail} onChange={(e) => setNewRestaurant({ ...newRestaurant, ownerEmail: e.target.value })} /></label>
                    <label className="grid gap-1 text-xs font-medium">Assigned plan
                      <select className="input" value={newRestaurant.planKey} onChange={(e) => setNewRestaurant({ ...newRestaurant, planKey: e.target.value })}>
                        <option value="STARTER">Starter</option>
                        <option value="GROWTH">Growth</option>
                        <option value="PREMIUM">Premium</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium md:col-span-2">Required audit reason<textarea className="input min-h-20 py-2" required minLength={8} maxLength={500} value={newRestaurant.reason} onChange={(e) => setNewRestaurant({ ...newRestaurant, reason: e.target.value })} placeholder="Why is this restaurant receiving a platform-created account?" /></label>
                    <p className="text-xs leading-5 text-charcoal/55 md:col-span-2">The account stays suspended until its owner activates the invite; the restaurant remains closed until the owner finishes setup and opens it.</p>
                    <div className="md:col-span-2"><button className="btn-primary text-xs" type="submit" disabled={creatingRestaurant}>{creatingRestaurant ? "Creating account…" : "Create account and invite owner"}</button></div>
                  </form>
                )}
                {createResult && (
                  <section className="mb-5 rounded border border-emerald-700/20 bg-emerald-50 p-4" aria-live="polite">
                    <h3 className="text-sm font-semibold text-emerald-900">Account created; owner setup is pending</h3>
                    <p className="mt-1 text-xs leading-5 text-emerald-900/75">This one-time link expires {new Date(createResult.invite.expiresAt).toLocaleString()}.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input min-w-0 flex-1 text-xs" aria-label="One-time owner activation link" readOnly value={createResult.invite.setupUrl} onFocus={(e) => e.target.select()} /><button className="btn-secondary whitespace-nowrap text-xs" type="button" onClick={() => copyInviteLink(createResult.invite.setupUrl)}>{inviteCopied ? "Copied" : "Copy invite link"}</button></div>
                    {copyError && <p className="mt-2 text-xs text-emerald-900/75">{copyError}</p>}
                    <p className="mt-2 text-xs text-emerald-900/75">Plan: {createResult.subscription.planKey} · Subscription: {createResult.subscription.status} · Account: {createResult.restaurant.status}</p>
                  </section>
                )}
                {reissueTarget && (
                  <form className="mb-5 grid gap-3 rounded border border-amber-700/20 bg-amber-50 p-4 md:grid-cols-2" onSubmit={reissueOwnerInvite}>
                    <div className="md:col-span-2"><h3 className="text-sm font-semibold">Issue a new owner invite for {reissueTarget.name}</h3><p className="mt-1 text-xs text-charcoal/60">The previous setup link will stop working. Add a reason to the platform audit record.</p></div>
                    {reissueError && <div className="md:col-span-2" role="alert"><ErrorBanner message={reissueError} /></div>}
                    <label className="grid gap-1 text-xs md:col-span-2">Required audit reason<textarea className="input min-h-20 py-2" required minLength={8} maxLength={500} value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} /></label>
                    <div className="flex gap-2 md:col-span-2"><button className="btn-primary text-xs" type="submit" disabled={reissuingInvite}>{reissuingInvite ? "Issuing link…" : "Issue new invite"}</button><button className="btn-secondary text-xs" type="button" onClick={() => { setReissueTarget(null); setReissueResult(null); }}>Cancel</button></div>
                  </form>
                )}
                {reissueResult && (
                  <section className="mb-5 rounded border border-amber-700/20 bg-amber-50 p-4" aria-live="polite">
                    <h3 className="text-sm font-semibold">New one-time invite issued</h3>
                    <p className="mt-1 text-xs leading-5 text-charcoal/65">The previous link has been invalidated. This link expires {new Date(reissueResult.invite.expiresAt).toLocaleString()}.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input min-w-0 flex-1 text-xs" aria-label="New owner activation link" readOnly value={reissueResult.invite.setupUrl} onFocus={(e) => e.target.select()} /><button className="btn-secondary whitespace-nowrap text-xs" type="button" onClick={() => copyInviteLink(reissueResult.invite.setupUrl)}>{inviteCopied ? "Copied" : "Copy invite link"}</button></div>
                    {copyError && <p className="mt-2 text-xs text-charcoal/70">{copyError}</p>}
                  </section>
                )}
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
                        <th className="px-5 py-2 font-medium text-right">Governance Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-charcoal/5 hover:bg-slate-50/50 transition">
                          <td className="px-5 py-2.5">
                            <p className="font-semibold text-slate-900">{r.name}</p>
                            <p className="text-charcoal/40 font-mono text-[10px]">/{r.slug}</p>
                          </td>
                          <td className="px-2 py-2.5 text-charcoal/60">{r.cuisineType || "—"}</td>
                          <td className="px-2 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              r.status === "SUSPENDED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : r.isOpenNow
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {r.status === "SUSPENDED" ? "Suspended" : r.isOpenNow ? "Open" : "Closed"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">{r.ownerSetupPending ? <div className="flex items-center gap-2"><span className="text-amber-700 font-medium">Pending</span>{canManageRestaurants && <button className="text-xs text-clove underline underline-offset-2" type="button" onClick={() => { setReissueTarget(r); setReissueResult(null); setReissueReason(""); setReissueError(null); setInviteCopied(false); setCopyError(null); }}>New invite</button>}</div> : <span className="text-charcoal/45">—</span>}</td>
                          <td className="px-2 py-2.5 text-right font-medium">{r.staffCount}</td>
                          <td className="px-2 py-2.5 text-right font-medium">{r.tableCount}</td>
                          <td className="px-2 py-2.5 text-right font-medium">{r.menuItemCount}</td>
                          <td className="px-2 py-2.5 text-right font-medium">{r.orderCount}</td>
                          <td className="px-5 py-2.5 text-right font-bold text-slate-900">₹{Number(r.totalRevenue).toLocaleString("en-IN")}</td>
                          <td className="px-5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openRestaurantDetails(r.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition"
                              >
                                Inspect
                              </button>
                              {canManageRestaurants && (
                                <button
                                  onClick={() => handleToggleRestaurantStatus(r)}
                                  disabled={togglingStatusId === r.id}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded border transition ${
                                    r.status === "ACTIVE"
                                      ? "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200"
                                      : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                                  }`}
                                >
                                  {togglingStatusId === r.id ? "…" : r.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                                </button>
                              )}
                              <a
                                href={`/r/${r.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1.5 py-1 text-slate-400 hover:text-slate-800 text-[12px]"
                                title="Open customer QR menu"
                              >
                                ↗
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && <tr><td className="px-5 py-8 text-center text-charcoal/50" colSpan={10}>No restaurant accounts match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Inspect Restaurant Drawer */}
                {inspectingRestaurant && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
                    <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">{inspectingRestaurant.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              inspectingRestaurant.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {inspectingRestaurant.status}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">ID: {inspectingRestaurant.id} · /{inspectingRestaurant.slug}</span>
                        </div>
                        <button onClick={() => setInspectingRestaurant(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
                      </div>

                      {/* Operational Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">₹{inspectingRestaurant.metrics?.totalRevenue?.toLocaleString("en-IN") || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Orders</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{inspectingRestaurant._count?.orders || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Tables</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{inspectingRestaurant._count?.tables || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Menu Items</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{inspectingRestaurant._count?.menuItems || 0}</p>
                        </div>
                      </div>

                      {/* Staff & Owner Profiles */}
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">Registered Staff & Owner</h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {(inspectingRestaurant.users || []).map((u) => (
                            <div key={u.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">{u.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700">
                                  {u.role}
                                </span>
                                <span className={`w-2 h-2 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Subscriptions */}
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">SaaS Subscriptions</h4>
                        {(inspectingRestaurant.subscriptions || []).length === 0 ? (
                          <p className="text-xs text-slate-400">No active SaaS subscription.</p>
                        ) : (
                          <div className="space-y-2">
                            {inspectingRestaurant.subscriptions.map((s) => (
                              <div key={s.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-slate-900">{s.planKey} Plan</span>
                                  <span className="text-slate-500 block text-[11px]">{s.billingPeriod} · ₹{s.amount}</span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {s.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recent Orders */}
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">Recent Dining Orders</h4>
                        {(inspectingRestaurant.recentOrders || []).length === 0 ? (
                          <p className="text-xs text-slate-400">No orders recorded yet.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                            {inspectingRestaurant.recentOrders.map((o) => (
                              <div key={o.id} className="p-3 flex justify-between items-center text-xs">
                                <div>
                                  <span className="font-bold text-slate-800">Order #{o.orderNumber || o.id.slice(0, 6)}</span>
                                  <span className="text-[10px] text-slate-400 block">{new Date(o.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-slate-900">₹{o.totalAmount}</span>
                                  <span className="text-[10px] text-slate-500 block">{o.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex justify-between">
                        <button
                          onClick={() => handleToggleRestaurantStatus(inspectingRestaurant)}
                          className={`px-4 py-2 text-xs font-semibold rounded-lg border transition ${
                            inspectingRestaurant.status === "ACTIVE"
                              ? "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200"
                              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                          }`}
                        >
                          {inspectingRestaurant.status === "ACTIVE" ? "Suspend Restaurant" : "Reactivate Restaurant"}
                        </button>
                        <button
                          onClick={() => setInspectingRestaurant(null)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 2: SUBSCRIPTIONS & REVENUE */}
        {activeTab === "subscriptions" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Subscriptions" value={subscriptionsList.length} sub={`${activeSubs.length} currently active`} />
              <StatCard label="Estimated MRR" value={`₹${Math.round(estimatedMrr).toLocaleString("en-IN")}`} sub="Normalized monthly recurring" />
              <StatCard label="Trialing Restaurants" value={subscriptionsList.filter((s) => s.status === "TRIALING").length} sub="14-day free trial" />
              <StatCard label="Past Due / Expired" value={subscriptionsList.filter((s) => s.status === "EXPIRED" || s.status === "PAST_DUE").length} sub="Requiring renewal" />
            </div>

            <div className="card p-5">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-base">Subscription Accounts</h2>
                  <p className="mt-0.5 text-xs text-charcoal/50">All provisioned restaurant tenant subscriptions and statuses</p>
                </div>
                <div className="flex items-center gap-2">
                  <select className="input text-xs py-1.5" value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TRIALING">Trialing</option>
                    <option value="PAST_DUE">Past Due</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="GRANDFATHERED">Grandfathered</option>
                  </select>
                  <button className="btn-secondary text-xs" onClick={loadSubscriptions} disabled={loadingSubscriptions}>
                    {loadingSubscriptions ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-charcoal/40 border-b border-charcoal/10">
                      <th className="px-5 py-2 font-medium">Restaurant</th>
                      <th className="px-2 py-2 font-medium">Plan</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Billing Period</th>
                      <th className="px-2 py-2 font-medium text-right">Amount</th>
                      <th className="px-2 py-2 font-medium">Starts At</th>
                      <th className="px-2 py-2 font-medium">Renewal / Expiry</th>
                      <th className="px-5 py-2 font-medium text-right">Latest Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((s) => {
                      const latestPayment = s.payments?.[0];
                      const statusColor = s.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : s.status === "TRIALING"
                        ? "bg-blue-100 text-blue-800"
                        : s.status === "PAST_DUE"
                        ? "bg-amber-100 text-amber-800"
                        : s.status === "GRANDFATHERED"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-red-100 text-red-800";

                      return (
                        <tr key={s.id} className="border-b border-charcoal/5">
                          <td className="px-5 py-3">
                            <p className="font-medium text-charcoal">{s.restaurant?.name || "Unknown"}</p>
                            <p className="text-charcoal/40">/{s.restaurant?.slug}</p>
                          </td>
                          <td className="px-2 py-3">
                            <span className="font-semibold text-charcoal/80 uppercase tracking-wider text-[10px] bg-charcoal/5 px-2 py-0.5 rounded">
                              {s.planKey}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusColor}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-charcoal/70">{s.billingPeriod || "MONTHLY"}</td>
                          <td className="px-2 py-3 text-right font-medium text-charcoal">₹{Number(s.amount || 0).toLocaleString("en-IN")}</td>
                          <td className="px-2 py-3 text-charcoal/60">{s.startsAt ? new Date(s.startsAt).toLocaleDateString() : "—"}</td>
                          <td className="px-2 py-3 text-charcoal/70">
                            {s.endsAt ? new Date(s.endsAt).toLocaleDateString() : s.trialEndsAt ? `Trial: ${new Date(s.trialEndsAt).toLocaleDateString()}` : "Non-expiring"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {latestPayment ? (
                              <span className={`inline-block text-[11px] px-2 py-0.5 rounded ${latestPayment.status === "PAID" ? "bg-emerald-50 text-emerald-700 font-medium" : "bg-charcoal/10 text-charcoal/60"}`}>
                                {latestPayment.provider} · ₹{latestPayment.amount} ({latestPayment.status})
                              </span>
                            ) : (
                              <span className="text-charcoal/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSubs.length === 0 && (
                      <tr>
                        <td className="px-5 py-8 text-center text-charcoal/50" colSpan={8}>
                          No subscriptions recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PACKAGES & DYNAMIC PRICING */}
        {activeTab === "packages" && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg">Subscription Packages & Pricing Configuration</h2>
                <p className="mt-0.5 text-xs text-charcoal/60">Configure monthly rates for Starter, Growth, and Premium tiers. Multi-period rates calculate automatically with standard term discounts (5%, 10%, 20%).</p>
              </div>
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={handleSavePricing}
                disabled={savingPrices}
              >
                {savingPrices ? "Saving Pricing…" : "Save Dynamic Pricing"}
              </button>
            </div>

            {pricingSuccess && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">{pricingSuccess}</div>}
            {pricingError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">{pricingError}</div>}

            <div className="grid md:grid-cols-3 gap-6">
              {(packagesData?.plans || []).map((plan) => {
                const planPrices = editPrices[plan.key] || plan.prices || {};
                const isPremium = plan.key === "PREMIUM";
                const isGrowth = plan.key === "GROWTH";

                return (
                  <div key={plan.key} className={`card p-6 flex flex-col justify-between ${isGrowth ? "border-amber-400 ring-1 ring-amber-400" : ""}`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-base uppercase tracking-wider">{plan.name}</span>
                        {isGrowth && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">POPULAR</span>}
                        {isPremium && <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">FULL SUITE</span>}
                      </div>

                      <div className="mb-5 bg-charcoal/5 p-4 rounded-lg">
                        <label className="block text-xs font-medium text-charcoal/70 mb-1">Monthly Base Price (₹)</label>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold font-display text-charcoal">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            className="input font-bold text-lg w-full"
                            value={planPrices.MONTHLY || ""}
                            onChange={(e) => handleMonthlyPriceChange(plan.key, e.target.value)}
                          />
                        </div>
                        <p className="text-[11px] text-charcoal/40 mt-1">Billed per calendar month (+ 18% GST)</p>
                      </div>

                      <div className="space-y-2 mb-6 text-xs text-charcoal/70 border-t border-charcoal/10 pt-4">
                        <p className="font-semibold text-charcoal mb-2">Multi-Period Rates</p>
                        <div className="flex justify-between py-1 border-b border-charcoal/5">
                          <span>3 Months (~5% off):</span>
                          <span className="font-medium text-charcoal">₹{planPrices["3_MONTHS"]?.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-charcoal/5">
                          <span>6 Months (~10% off):</span>
                          <span className="font-medium text-charcoal">₹{planPrices["6_MONTHS"]?.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Yearly (~20% off):</span>
                          <span className="font-medium text-charcoal">₹{planPrices.YEARLY?.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      <div className="border-t border-charcoal/10 pt-4">
                        <p className="text-xs font-semibold text-charcoal mb-2">Entitled Features</p>
                        <ul className="space-y-1.5 text-xs text-charcoal/70">
                          {(plan.features || []).map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PENDING REGISTRATIONS */}
        {activeTab === "onboardings" && (
          <div className="card p-5">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-base">Pending Onboarding Registrations</h2>
                <p className="mt-0.5 text-xs text-charcoal/50">Recent restaurant registrations in progress, OTP verification & checkout attempts</p>
              </div>
              <button className="btn-secondary text-xs" onClick={loadPendingOnboardings} disabled={loadingOnboardings}>
                {loadingOnboardings ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-charcoal/40 border-b border-charcoal/10">
                    <th className="px-5 py-2 font-medium">Restaurant</th>
                    <th className="px-2 py-2 font-medium">Owner</th>
                    <th className="px-2 py-2 font-medium">Plan</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Payment Provider</th>
                    <th className="px-2 py-2 font-medium">Created At</th>
                    <th className="px-5 py-2 font-medium text-right">Expires At</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOnboardingsList.map((p) => {
                    const statusColor = p.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800"
                      : p.status === "PENDING_PAYMENT"
                      ? "bg-amber-100 text-amber-800"
                      : p.status === "PENDING_OTP"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800";

                    return (
                      <tr key={p.id} className="border-b border-charcoal/5">
                        <td className="px-5 py-3">
                          <p className="font-medium text-charcoal">{p.restaurantName}</p>
                          <p className="text-charcoal/40">/{p.slug}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p className="font-medium">{p.ownerName}</p>
                          <p className="text-charcoal/50">{p.emailClaim || p.ownerEmail || "—"}</p>
                        </td>
                        <td className="px-2 py-3 font-semibold text-charcoal/80 uppercase text-[10px]">
                          {p.planKey}
                        </td>
                        <td className="px-2 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusColor}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-charcoal/60">
                          {p.payments?.[0]?.provider ? `${p.payments[0].provider} (₹${p.payments[0].amount})` : "None"}
                        </td>
                        <td className="px-2 py-3 text-charcoal/60">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-charcoal/50">{new Date(p.expiresAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {pendingOnboardingsList.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-charcoal/50" colSpan={7}>
                        No pending onboardings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === "audit" || activeTab === "security") && (
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-charcoal/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold text-sm">Administrative audit events</h2><p className="mt-1 text-xs text-charcoal/50">Platform actions recorded by the current audit service.</p></div>
              <button className="btn-secondary text-xs" type="button" onClick={() => loadAudit()} disabled={loadingAudit}>{loadingAudit ? "Refreshing…" : "Refresh"}</button>
            </div>
            {auditError && <div className="p-5"><ErrorBanner message={auditError} /></div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-charcoal/10 bg-charcoal/[0.025] text-charcoal/55">
                  <th className="px-5 py-3 font-medium">Timestamp</th><th className="px-3 py-3 font-medium">Actor</th><th className="px-3 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Target</th>
                </tr></thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr className="border-b border-charcoal/5" key={entry.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-charcoal/55">{new Date(entry.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3">{entry.actor?.name || "System"}{entry.actor?.email && <span className="mt-1 block text-charcoal/45">{entry.actor.email}</span>}</td>
                      <td className="px-3 py-3 font-medium">{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</td>
                      <td className="px-5 py-3 text-charcoal/55">{entry.targetRestaurantId || entry.targetAdminId || "—"}</td>
                    </tr>
                  ))}
                  {!loadingAudit && auditEntries.length === 0 && !auditError && <tr><td className="px-5 py-8 text-center text-charcoal/50" colSpan={4}>No audit events recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 5: COMMUNICATIONS & MESSAGING */}
        {activeTab === "communications" && (
          <div className="space-y-8">
            {/* Header & Connection Test Action */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-charcoal/10 shadow-sm">
              <div>
                <h2 className="text-xl font-display font-semibold text-charcoal">Communications & Messaging Hub</h2>
                <p className="text-xs text-charcoal/60 mt-0.5">
                  Centralized Twilio SMS, WhatsApp notifications, OTP verification, and delivery tracking.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={commConnTesting}
                  onClick={handleTestConnection}
                  className="px-4 py-2 bg-charcoal text-cream text-xs font-medium rounded hover:bg-charcoal/90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {commConnTesting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-cream border-t-transparent rounded-full animate-spin"></span>
                      Checking Twilio...
                    </>
                  ) : (
                    "Test Twilio Connection"
                  )}
                </button>
                <button
                  type="button"
                  onClick={loadCommunications}
                  disabled={loadingComm}
                  className="px-3 py-2 bg-charcoal/5 hover:bg-charcoal/10 text-charcoal text-xs font-medium rounded transition"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Connection Test Diagnostic Banner */}
            {commConnResult && (
              <div className={`p-4 rounded-lg text-xs border ${commConnResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">
                    {commConnResult.success ? "✓ Twilio API Connection Verified" : "✗ Twilio Connection Failed"}
                  </div>
                  <button onClick={() => setCommConnResult(null)} className="text-charcoal/40 hover:text-charcoal font-bold">✕</button>
                </div>
                <p className="mt-1">
                  {commConnResult.success
                    ? `Connected to Twilio account "${commConnResult.friendlyName}" (${commConnResult.accountStatus}). SMS Ready: ${commConnResult.smsReady ? "Yes" : "No"}, WhatsApp Ready: ${commConnResult.whatsappReady ? "Yes" : "No"}.`
                    : commConnResult.message}
                </p>
              </div>
            )}

            {/* Provider Readiness Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-charcoal/50 uppercase tracking-wider font-semibold">Twilio SMS</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${commStatus?.twilio?.smsConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {commStatus?.twilio?.smsConfigured ? "Ready" : "Unconfigured"}
                  </span>
                </div>
                <p className="text-lg font-mono font-semibold text-charcoal truncate">
                  {commStatus?.twilio?.smsSender || "No number set"}
                </p>
                <p className="text-xs text-charcoal/50 mt-1 truncate">
                  SID: {commStatus?.twilio?.accountSidMasked || "Not linked"}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-charcoal/50 uppercase tracking-wider font-semibold">Twilio WhatsApp</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${commStatus?.twilio?.whatsappConfigured ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10 text-charcoal/60"}`}>
                    {commStatus?.twilio?.whatsappConfigured ? "Ready" : "Standby"}
                  </span>
                </div>
                <p className="text-lg font-mono font-semibold text-charcoal truncate">
                  {commStatus?.twilio?.whatsappSender || "No sender set"}
                </p>
                <p className="text-xs text-charcoal/50 mt-1">
                  Fallback enabled: Yes (SMS)
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-charcoal/50 uppercase tracking-wider font-semibold">Meta WhatsApp Cloud</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${commStatus?.meta?.configured ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10 text-charcoal/60"}`}>
                    {commStatus?.meta?.configured ? "Active" : "Standby"}
                  </span>
                </div>
                <p className="text-lg font-semibold text-charcoal truncate">
                  {commStatus?.meta?.templateName || "Default OTP"}
                </p>
                <p className="text-xs text-charcoal/50 mt-1">
                  Provider Mode: {commStatus?.whatsappProvider?.toUpperCase() || "AUTO"}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-charcoal/50 uppercase tracking-wider font-semibold">30-Day Delivery</p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                    Live
                  </span>
                </div>
                <p className="text-2xl font-display font-semibold text-charcoal">
                  {commStats?.deliveryRate ?? 100}%
                </p>
                <p className="text-xs text-charcoal/50 mt-1">
                  {commStats?.delivered || 0} delivered · {commStats?.failed || 0} failed
                </p>
              </div>
            </div>

            {/* Test Messenger & Live Dispatch */}
            <div className="bg-white p-6 rounded-lg border border-charcoal/10 shadow-sm">
              <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider mb-2">Live Test Message Dispatch</h3>
              <p className="text-xs text-charcoal/60 mb-4">
                Verify end-to-end delivery by dispatching a live test message to an international phone number.
              </p>

              <form onSubmit={handleSendTestMessage} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Channel</label>
                  <select
                    value={commTestChannel}
                    onChange={(e) => setCommTestChannel(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded border-charcoal/20 bg-white"
                  >
                    <option value="sms">Twilio SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Recipient Phone (+E.164)</label>
                  <input
                    type="text"
                    required
                    placeholder="+919876543210"
                    value={commTestPhone}
                    onChange={(e) => setCommTestPhone(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded border-charcoal/20 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-charcoal mb-1">Custom Message Body (Optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Svaadya test dispatch message..."
                      value={commTestMessage}
                      onChange={(e) => setCommTestMessage(e.target.value)}
                      className="w-full text-xs p-2.5 border rounded border-charcoal/20"
                    />
                    <button
                      type="submit"
                      disabled={commTesting || !commTestPhone}
                      className="px-5 py-2.5 bg-marigold text-charcoal font-semibold text-xs rounded hover:bg-marigold/90 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {commTesting ? "Sending..." : "Send Test"}
                    </button>
                  </div>
                </div>
              </form>

              {commTestResult && (
                <div className={`mt-4 p-3 rounded text-xs border ${commTestResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  {commTestResult.success ? (
                    <div>
                      <span className="font-semibold">✓ Test message dispatched!</span> SID: <code className="font-mono">{commTestResult.providerRef}</code> | Channel: <span className="uppercase font-semibold">{commTestResult.channel}</span> | Status: <span className="capitalize">{commTestResult.status}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold">✗ Dispatch failed:</span> {commTestResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Template Management */}
            <div className="bg-white p-6 rounded-lg border border-charcoal/10 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Message Templates Registry</h3>
                  <p className="text-xs text-charcoal/60">Standardized transactional message formats with dynamic variable hydration.</p>
                </div>
                {templateSuccess && (
                  <span className="text-xs text-emerald-700 bg-emerald-100 px-3 py-1 rounded font-medium">
                    {templateSuccess}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commTemplates.map((tpl) => (
                  <div key={tpl.key} className="border border-charcoal/10 rounded-lg p-4 bg-cream/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-xs text-charcoal">{tpl.title || tpl.key}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-charcoal/10 rounded text-charcoal/70">
                          {tpl.channel}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/80 bg-white p-3 rounded border border-charcoal/5 font-mono text-[11px] leading-relaxed">
                        {tpl.body}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-charcoal/5">
                      <span className="text-[10px] text-charcoal/40 uppercase font-mono">{tpl.key}</span>
                      <button
                        type="button"
                        onClick={() => setEditingTemplate({ ...tpl })}
                        className="text-xs text-marigold font-semibold hover:underline"
                      >
                        Edit Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Template Editor Modal */}
              {editingTemplate && (
                <div className="fixed inset-0 bg-charcoal/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl border border-charcoal/10">
                    <h3 className="text-base font-semibold text-charcoal mb-1">Edit Template: {editingTemplate.title}</h3>
                    <p className="text-xs text-charcoal/60 mb-4 font-mono">{editingTemplate.key}</p>

                    <form onSubmit={handleSaveTemplate} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-charcoal mb-1">Display Title</label>
                        <input
                          type="text"
                          required
                          value={editingTemplate.title}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                          className="w-full text-xs p-2.5 border rounded border-charcoal/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-charcoal mb-1">Channel Support</label>
                        <select
                          value={editingTemplate.channel}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, channel: e.target.value })}
                          className="w-full text-xs p-2.5 border rounded border-charcoal/20 bg-white"
                        >
                          <option value="both">Both (WhatsApp & SMS)</option>
                          <option value="sms">SMS Only</option>
                          <option value="whatsapp">WhatsApp Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-charcoal mb-1">Message Body (Supports &#123;&#123;variable&#125;&#125; placeholders)</label>
                        <textarea
                          rows={4}
                          required
                          value={editingTemplate.body}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                          className="w-full text-xs p-2.5 border rounded border-charcoal/20 font-mono text-[11px]"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-charcoal/10">
                        <button
                          type="button"
                          onClick={() => setEditingTemplate(null)}
                          className="px-4 py-2 border rounded text-xs text-charcoal/70 hover:bg-charcoal/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingTemplate}
                          className="px-4 py-2 bg-charcoal text-cream font-semibold text-xs rounded hover:bg-charcoal/90 disabled:opacity-50"
                        >
                          {savingTemplate ? "Saving..." : "Save Template"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Live Communication Logs */}
            <div className="bg-white rounded-lg border border-charcoal/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-charcoal/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Live Communication Logs</h3>
                  <p className="text-xs text-charcoal/60">Real-time delivery status, sanitized provider responses, and error diagnostics.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={commFilterChannel}
                    onChange={(e) => setCommFilterChannel(e.target.value)}
                    className="text-xs p-2 border rounded border-charcoal/20 bg-white"
                  >
                    <option value="ALL">All Channels</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>

                  <select
                    value={commFilterStatus}
                    onChange={(e) => setCommFilterStatus(e.target.value)}
                    className="text-xs p-2 border rounded border-charcoal/20 bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="delivered">Delivered</option>
                    <option value="sent">Sent</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={commFilterPurpose}
                    onChange={(e) => setCommFilterPurpose(e.target.value)}
                    className="text-xs p-2 border rounded border-charcoal/20 bg-white"
                  >
                    <option value="ALL">All Purposes</option>
                    <option value="otp">OTP Verification</option>
                    <option value="order_confirmation">Order Confirmation</option>
                    <option value="order_status">Order Status</option>
                    <option value="owner_order_alert">Owner Alert</option>
                    <option value="staff_invite">Staff Invite</option>
                    <option value="subscription_alert">Subscription</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Search phone..."
                    value={commSearch}
                    onChange={(e) => setCommSearch(e.target.value)}
                    className="text-xs p-2 border rounded border-charcoal/20 w-36"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-charcoal/5 border-b border-charcoal/10 text-charcoal/70 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-3 py-3">Channel</th>
                      <th className="px-3 py-3">Purpose</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3">Provider Ref</th>
                      <th className="px-4 py-3">Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commLogs.map((log) => {
                      const statusBadge = log.status === "delivered"
                        ? "bg-emerald-100 text-emerald-800"
                        : log.status === "sent" || log.status === "queued"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800";

                      return (
                        <tr key={log.id} className="border-b border-charcoal/5 hover:bg-cream/20">
                          <td className="px-5 py-3 text-charcoal/60 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-3">
                            <span className="uppercase font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-charcoal/5 text-charcoal/80">
                              {log.channel}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-medium text-charcoal whitespace-nowrap">
                            {log.purpose?.replaceAll("_", " ")}
                          </td>
                          <td className="px-4 py-3 font-mono text-charcoal/90">
                            {log.phoneMasked || log.phone}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize ${statusBadge}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-charcoal/50 truncate max-w-[140px]">
                            {log.providerRef || "—"}
                          </td>
                          <td className="px-4 py-3 text-charcoal/60 max-w-xs truncate">
                            {log.errorMessage ? (
                              <span className="text-red-700">{log.errorCode ? `[${log.errorCode}] ` : ""}{log.errorMessage}</span>
                            ) : log.deliveredAt ? (
                              <span className="text-emerald-700">Delivered {new Date(log.deliveredAt).toLocaleTimeString()}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {commLogs.length === 0 && (
                      <tr>
                        <td className="px-5 py-8 text-center text-charcoal/50" colSpan={7}>
                          No communication logs found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {commLogsPagination.pages > 1 && (
                <div className="p-4 border-t border-charcoal/10 flex items-center justify-between text-xs">
                  <span className="text-charcoal/50">
                    Page {commLogsPagination.page} of {commLogsPagination.pages} ({commLogsPagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={commLogsPagination.page <= 1}
                      onClick={() => setCommLogsPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      className="px-3 py-1 border rounded disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={commLogsPagination.page >= commLogsPagination.pages}
                      onClick={() => setCommLogsPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      className="px-3 py-1 border rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modular Enterprise Tabs */}
        {activeTab === "analytics" && <PlatformAnalyticsTab overview={overview} />}
        {activeTab === "users" && <PlatformUsersTab />}
        {activeTab === "onboarding" && <PlatformOnboardingTab />}
        {activeTab === "billing" && <PlatformBillingTab overview={overview} />}
        {activeTab === "roles" && <PlatformRolesTab />}
        {activeTab === "support" && <PlatformSupportTab restaurants={restaurants} />}
        {activeTab === "health" && <PlatformHealthTab />}
        {activeTab === "settings" && <PlatformSettingsTab />}
      </div>
    </main>
  );
}
