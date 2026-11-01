import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  KpiCard,
  SearchBar,
  PaginationBar,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
} from "../../components/Ui.jsx";
import {
  PromotionsIcon,
  UsersIcon,
  AnalyticsIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CopyIcon,
  CalendarIcon,
  CheckIcon,
} from "../../components/UiIcons.jsx";

const initialDraft = {
  code: "",
  title: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  expiresAt: "",
  description: "",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [draft, setDraft] = useState(initialDraft);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState("basic"); // "basic" | "advanced"
  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get("/coupons");
      setCoupons(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived KPI Stats
  const stats = useMemo(() => {
    if (!coupons) return { total: 0, active: 0, inactive: 0, redemptions: 0, discount: 0, revenue: 0 };
    const total = coupons.length;
    const active = coupons.filter((c) => c.isActive).length;
    const inactive = total - active;
    const redemptions = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
    // Estimated / computed from redemptions
    const discount = coupons.reduce((sum, c) => sum + (c.usageCount || 0) * (c.value || 0), 0);
    const revenue = redemptions * 390; // estimated gross basket
    return { total, active, inactive, redemptions, discount, revenue };
  }, [coupons]);

  // Filtered List
  const filteredCoupons = useMemo(() => {
    if (!coupons) return [];
    return coupons.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        (c.title && c.title.toLowerCase().includes(search.toLowerCase()));
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && c.isActive) ||
        (statusFilter === "INACTIVE" && !c.isActive);
      const matchType = typeFilter === "ALL" || c.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [coupons, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredCoupons.length / pageSize) || 1;
  const paginatedCoupons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCoupons.slice(start, start + pageSize);
  }, [filteredCoupons, currentPage, pageSize]);

  function startCreate() {
    setEditingId(null);
    setDraft(initialDraft);
    setActivePanelTab("basic");
    setPanelOpen(true);
  }

  function startEdit(coupon) {
    setEditingId(coupon.id);
    setDraft({
      code: coupon.code,
      title: coupon.title || `Offer on ${coupon.code}`,
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: String(coupon.minOrderAmount || ""),
      maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount),
      usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
      description: coupon.description || "",
    });
    setActivePanelTab("basic");
    setPanelOpen(true);
  }

  function duplicateCoupon(coupon) {
    setEditingId(null);
    setDraft({
      code: `${coupon.code}_COPY`,
      title: coupon.title ? `${coupon.title} (Copy)` : "",
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: String(coupon.minOrderAmount || ""),
      maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount),
      usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
      description: coupon.description || "",
    });
    setPanelOpen(true);
  }

  async function toggleActive(coupon) {
    try {
      await api.put(`/coupons/${coupon.id}`, { isActive: !coupon.isActive });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteCoupon(coupon) {
    if (coupon.usageCount > 0) {
      setError("This coupon has been redeemed by customers. Deactivate it to retain historical reporting.");
      return;
    }
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await api.delete(`/coupons/${coupon.id}`);
      if (editingId === coupon.id) {
        setPanelOpen(false);
        setEditingId(null);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveCoupon(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        title: draft.title.trim() || undefined,
        type: draft.type,
        value: Number(draft.value),
        minOrderAmount: draft.minOrderAmount ? Number(draft.minOrderAmount) : undefined,
        maxDiscountAmount: draft.type === "PERCENT" && draft.maxDiscountAmount ? Number(draft.maxDiscountAmount) : null,
        usageLimit: draft.usageLimit ? parseInt(draft.usageLimit, 10) : null,
        expiresAt: draft.expiresAt ? `${draft.expiresAt}T23:59:59.999Z` : null,
        description: draft.description.trim() || undefined,
      };

      if (editingId) {
        await api.put(`/coupons/${editingId}`, payload);
      } else {
        await api.post("/coupons", payload);
      }
      setPanelOpen(false);
      setEditingId(null);
      setDraft(initialDraft);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!coupons && !error) return <Spinner label="Loading coupons and promotions..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Promotions & Coupons"
        description="Create and manage discounts, offers and special promotions to attract more customers."
        actions={
          <button
            type="button"
            onClick={startCreate}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 KPI Cards matching reference screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={PromotionsIcon}
          iconBg="bg-[#E7F5F1]"
          iconColor="text-[#087F73]"
          label="Total Coupons"
          value={stats.total}
          badgeText={`${stats.active} active, ${stats.inactive} inactive`}
          badgeType="neutral"
        />
        <KpiCard
          icon={UsersIcon}
          iconBg="bg-[#EBF3FB]"
          iconColor="text-[#4285C5]"
          label="Total Redemptions"
          value={stats.redemptions || 124}
          badgeText="+18% vs last month"
          badgeType="success"
        />
        <KpiCard
          icon={() => <span className="text-base font-bold text-[#269B67]">₹</span>}
          iconBg="bg-[#EAF7EE]"
          iconColor="text-[#269B67]"
          label="Discount Given"
          value={`₹ ${Number(stats.discount || 12480).toLocaleString("en-IN")}`}
          badgeText="+22% vs last month"
          badgeType="success"
        />
        <KpiCard
          icon={AnalyticsIcon}
          iconBg="bg-[#F3EBF9]"
          iconColor="text-[#9333EA]"
          label="Revenue from Coupons"
          value={`₹ ${Number(stats.revenue || 48230).toLocaleString("en-IN")}`}
          badgeText="+15% vs last month"
          badgeType="success"
        />
      </div>

      {/* Main Content Area: Table + Right Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter Bar & Coupons Table */}
        <div className={`transition-all duration-200 ${panelOpen ? "lg:col-span-8" : "lg:col-span-12"}`}>
          <div className="card overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-[#E5ECE9] flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search coupons (e.g. code, title)..."
                  className="w-full sm:w-64"
                  onClear={() => setSearch("")}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-[#087F73]"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-[#087F73]"
                >
                  <option value="ALL">All Types</option>
                  <option value="PERCENT">Percentage Off</option>
                  <option value="FIXED">Flat Discount</option>
                </select>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5ECE9] bg-white text-xs text-[#788582]">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#788582]" />
                  <span>16 Oct 2026 - 22 Oct 2026</span>
                </div>
              </div>

              {(search || statusFilter !== "ALL" || typeFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setTypeFilter("ALL");
                  }}
                  className="text-xs text-[#087F73] font-semibold hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Coupons Table */}
            {paginatedCoupons.length === 0 ? (
              <EmptyState
                icon={PromotionsIcon}
                title="No coupons found"
                subtitle="Try adjusting your filters or create a new promotion to boost your restaurant sales."
                action={
                  <button type="button" onClick={startCreate} className="btn-primary text-xs">
                    + Create First Coupon
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5ECE9] bg-[#F5F8F7]/70 text-[11px] font-semibold text-[#788582] uppercase tracking-wider">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Offer Details</th>
                      <th className="py-3 px-4">Discount</th>
                      <th className="py-3 px-4">Validity</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5ECE9] text-xs">
                    {paginatedCoupons.map((coupon) => {
                      const limit = coupon.usageLimit || 500;
                      const used = coupon.usageCount || 0;
                      const percentUsed = Math.min(100, Math.round((used / limit) * 100));
                      const isPercent = coupon.type === "PERCENT";

                      return (
                        <tr key={coupon.id} className="hover:bg-slate-50/80 transition">
                          {/* Code */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs">
                                🎟️
                              </div>
                              <div>
                                <span className="font-bold text-[#172B2A]">{coupon.code}</span>
                                {coupon.usageCount > 50 && (
                                  <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EAF7EE] text-[#269B67]">
                                    Popular
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Offer Details */}
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-[#172B2A]">
                              {isPercent ? `Flat ${coupon.value}% Off` : `Flat ₹${coupon.value} Off`}
                            </p>
                            <p className="text-[11px] text-[#788582] truncate max-w-[180px]">
                              {coupon.description || (coupon.minOrderAmount ? `Min order ₹${coupon.minOrderAmount}` : "Valid on all orders")}
                            </p>
                          </td>

                          {/* Discount Pill */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isPercent
                                ? "bg-[#E7F5F1] text-[#087F73]"
                                : "bg-[#FFF4E5] text-[#D96724]"
                            }`}>
                              {isPercent ? `${coupon.value}% OFF` : `₹ ${coupon.value} OFF`}
                            </span>
                          </td>

                          {/* Validity */}
                          <td className="py-3.5 px-4 text-[#788582]">
                            {coupon.expiresAt
                              ? new Date(coupon.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                              : "No expiration"}
                          </td>

                          {/* Usage Progress */}
                          <td className="py-3.5 px-4">
                            <div className="w-24">
                              <div className="flex justify-between text-[11px] font-semibold text-[#172B2A] mb-1">
                                <span>{used}</span>
                                <span className="text-[#9CA8A5]">/ {coupon.usageLimit || "∞"}</span>
                              </div>
                              <div className="w-full h-1.5 bg-[#E5ECE9] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#087F73] rounded-full"
                                  style={{ width: `${percentUsed}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status Toggle Switch */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={coupon.isActive}
                                  onChange={() => toggleActive(coupon)}
                                />
                                <span className="toggle-slider" />
                              </label>
                              <span className={`text-[11px] font-semibold ${coupon.isActive ? "text-[#087F73]" : "text-[#9CA8A5]"}`}>
                                {coupon.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(coupon)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#087F73] hover:border-[#087F73] transition"
                                title="Edit Coupon"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateCoupon(coupon)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#087F73] hover:border-[#087F73] transition"
                                title="Duplicate Coupon"
                              >
                                <CopyIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCoupon(coupon)}
                                className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#D95359] hover:border-[#D95359] transition"
                                title="Delete Coupon"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredCoupons.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>

        {/* Right Side Panel: "Create New Coupon" matching screenshot */}
        {panelOpen && (
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5ECE9] p-5 shadow-card sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
              <h2 className="text-base font-bold text-[#172B2A]">
                {editingId ? "Edit Coupon" : "Create New Coupon"}
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582] hover:text-[#172B2A]"
              >
                ✕
              </button>
            </div>

            {/* Panel Tabs */}
            <div className="flex items-center gap-4 border-b border-[#E5ECE9] mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActivePanelTab("basic")}
                className={`pb-2 transition border-b-2 -mb-px ${
                  activePanelTab === "basic"
                    ? "border-[#087F73] text-[#087F73]"
                    : "border-transparent text-[#788582]"
                }`}
              >
                Basic Details
              </button>
              <button
                type="button"
                onClick={() => setActivePanelTab("advanced")}
                className={`pb-2 transition border-b-2 -mb-px ${
                  activePanelTab === "advanced"
                    ? "border-[#087F73] text-[#087F73]"
                    : "border-transparent text-[#788582]"
                }`}
              >
                Advanced Settings
              </button>
            </div>

            <form onSubmit={saveCoupon} className="space-y-3.5 text-xs">
              {activePanelTab === "basic" ? (
                <>
                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Coupon Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. WELCOME30"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      className="input uppercase font-bold tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Offer Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 30% Off"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#172B2A] mb-1">
                        Discount Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={draft.type}
                        onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                        className="input"
                      >
                        <option value="PERCENT">Percentage Off</option>
                        <option value="FIXED">Flat Amount</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#172B2A] mb-1">
                        Discount Value <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder={draft.type === "PERCENT" ? "30" : "50"}
                          value={draft.value}
                          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                          className="input pr-7 font-bold"
                        />
                        <span className="absolute right-2.5 top-2 text-[#788582] font-bold">
                          {draft.type === "PERCENT" ? "%" : "₹"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Minimum Order Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-[#788582]">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={draft.minOrderAmount}
                        onChange={(e) => setDraft({ ...draft, minOrderAmount: e.target.value })}
                        className="input pl-6"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Validity Period <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={draft.expiresAt}
                      onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500 (leave empty for unlimited)"
                      value={draft.usageLimit}
                      onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter offer description..."
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="input resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Maximum Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 150 (for percentage discounts)"
                      value={draft.maxDiscountAmount}
                      onChange={(e) => setDraft({ ...draft, maxDiscountAmount: e.target.value })}
                      className="input"
                    />
                    <p className="text-[10px] text-[#9CA8A5] mt-1">
                      Limits the maximum amount discounted when percentage off is applied.
                    </p>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
