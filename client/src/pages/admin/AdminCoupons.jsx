import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { EmptyState, ErrorBanner, Spinner } from "../../components/Ui.jsx";

const emptyDraft = () => ({
  code: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  expiresAt: "",
});

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setCoupons(await api.get("/coupons"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function editCoupon(coupon) {
    setEditingId(coupon.id);
    setDraft({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: String(coupon.minOrderAmount || ""),
      maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount),
      usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft());
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
      setError("This coupon has been used. Deactivate it to retain its order history.");
      return;
    }
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await api.delete(`/coupons/${coupon.id}`);
      if (editingId === coupon.id) resetForm();
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
        type: draft.type,
        value: Number(draft.value),
        minOrderAmount: draft.minOrderAmount ? Number(draft.minOrderAmount) : undefined,
        maxDiscountAmount: draft.type === "PERCENT" && draft.maxDiscountAmount ? Number(draft.maxDiscountAmount) : null,
        usageLimit: draft.usageLimit ? Number.parseInt(draft.usageLimit, 10) : null,
        expiresAt: draft.expiresAt ? `${draft.expiresAt}T23:59:59.999Z` : null,
      };
      if (editingId) await api.put(`/coupons/${editingId}`, payload);
      else await api.post("/coupons", payload);
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!coupons && !error) return <Spinner label="Loading coupons..." />;

  return (
    <div className="space-y-6 p-5 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clove">Promotions</p>
        <h1 className="mt-2 font-display text-3xl">Coupons</h1>
        <p className="mt-2 max-w-2xl text-sm text-charcoal/55">
          Coupons apply to customer food orders and override the restaurant's default discount. Order snapshots keep historical totals unchanged.
        </p>
      </header>
      {error && <ErrorBanner message={error} />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={saveCoupon} className="card space-y-4 p-5 md:p-6">
          <div>
            <h2 className="font-display text-xl">{editingId ? "Edit coupon" : "Create coupon"}</h2>
            <p className="mt-1 text-xs text-charcoal/45">Discounts are validated again by the server at checkout.</p>
          </div>
          <label className="block text-xs font-medium text-charcoal/60">
            Coupon code
            <input className="input mt-1" placeholder="WELCOME10" required maxLength={32} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
          </label>
          <div className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(0,1fr)] gap-2">
            <label className="text-xs font-medium text-charcoal/60">
              Discount type
              <select className="input mt-1" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                <option value="PERCENT">Percent</option>
                <option value="FLAT">Flat amount</option>
              </select>
            </label>
            <label className="text-xs font-medium text-charcoal/60">
              {draft.type === "PERCENT" ? "Percent off" : "Amount off (INR)"}
              <input className="input mt-1" type="number" step="0.01" min="0.01" max={draft.type === "PERCENT" ? 100 : undefined} required value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-medium text-charcoal/60">
            Minimum order amount (INR)
            <input className="input mt-1" type="number" step="0.01" min="0" value={draft.minOrderAmount} onChange={(event) => setDraft({ ...draft, minOrderAmount: event.target.value })} />
          </label>
          {draft.type === "PERCENT" && <label className="block text-xs font-medium text-charcoal/60">
            Maximum discount (INR)
            <input className="input mt-1" type="number" step="0.01" min="0" value={draft.maxDiscountAmount} onChange={(event) => setDraft({ ...draft, maxDiscountAmount: event.target.value })} />
          </label>}
          <label className="block text-xs font-medium text-charcoal/60">
            Total usage limit <span className="font-normal text-charcoal/40">(blank means unlimited)</span>
            <input className="input mt-1" type="number" min="1" step="1" value={draft.usageLimit} onChange={(event) => setDraft({ ...draft, usageLimit: event.target.value })} />
          </label>
          <label className="block text-xs font-medium text-charcoal/60">
            Expiry date <span className="font-normal text-charcoal/40">(inclusive, UTC)</span>
            <input className="input mt-1" type="date" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} />
          </label>
          <div className="flex gap-2 pt-1">
            {editingId && <button type="button" className="btn-secondary flex-1" onClick={resetForm}>Cancel edit</button>}
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create coupon"}</button>
          </div>
        </form>

        <section className="card overflow-hidden">
          <div className="border-b border-charcoal/10 px-5 py-4">
            <h2 className="font-display text-xl">Your coupons</h2>
            <p className="mt-1 text-xs text-charcoal/45">{coupons?.length || 0} coupon{coupons?.length === 1 ? "" : "s"}</p>
          </div>
          {!coupons ? (
            <div className="space-y-3 p-5">
              <p className="text-sm text-charcoal/55">Coupon data could not be loaded.</p>
              <button type="button" className="btn-secondary" onClick={refresh}>Retry</button>
            </div>
          ) : coupons.length === 0 ? <EmptyState title="No coupons yet" subtitle="Create a promotion with the form to get started." /> : (
            <div className="divide-y divide-charcoal/10">
              {coupons.map((coupon) => (
                <article key={coupon.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{coupon.code} <span className="font-normal text-charcoal/50">· {coupon.type === "PERCENT" ? `${coupon.value}% off` : `₹${coupon.value} off`}</span></p>
                      <p className="mt-1 text-xs leading-5 text-charcoal/45">
                        {coupon.minOrderAmount > 0 && `Min ₹${coupon.minOrderAmount} · `}
                        {coupon.maxDiscountAmount != null && `Cap ₹${coupon.maxDiscountAmount} · `}
                        {coupon.usageLimit != null ? `${coupon.usageCount}/${coupon.usageLimit} used` : `${coupon.usageCount} used`}
                        {coupon.expiresAt ? ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : " · No expiry"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${coupon.isActive ? "bg-emerald-50 text-emerald-700" : "bg-charcoal/5 text-charcoal/50"}`}>
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary text-xs" onClick={() => editCoupon(coupon)}>Edit</button>
                    <button className="btn-secondary text-xs" onClick={() => toggleActive(coupon)}>{coupon.isActive ? "Deactivate" : "Activate"}</button>
                    {coupon.usageCount === 0 && <button className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => deleteCoupon(coupon)}>Delete unused</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
