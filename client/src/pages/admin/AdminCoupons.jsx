import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

const emptyDraft = {
  code: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  expiresAt: "",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null); // null | { ...form fields }

  async function refresh() {
    const data = await api.get("/coupons");
    setCoupons(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleActive(coupon) {
    await api.put(`/coupons/${coupon.id}`, { isActive: !coupon.isActive });
    refresh();
  }

  async function deleteCoupon(coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    await api.delete(`/coupons/${coupon.id}`);
    refresh();
  }

  async function saveCoupon(e) {
    e.preventDefault();
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        type: draft.type,
        value: parseFloat(draft.value),
        minOrderAmount: draft.minOrderAmount ? parseFloat(draft.minOrderAmount) : undefined,
        maxDiscountAmount: draft.maxDiscountAmount ? parseFloat(draft.maxDiscountAmount) : null,
        usageLimit: draft.usageLimit ? parseInt(draft.usageLimit, 10) : null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
      };
      await api.post("/coupons", payload);
      setDraft(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!coupons) return <Spinner label="Loading coupons..." />;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl mb-1">Coupons</h1>
          <p className="text-sm text-charcoal/50">
            Customers apply these codes at checkout. A coupon overrides the restaurant's default
            discount for that order (they don't stack).
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setDraft({ ...emptyDraft })}>
          + New Coupon
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {coupons.length === 0 ? (
        <p className="text-sm text-charcoal/40">No coupons yet.</p>
      ) : (
        <div className="card divide-y divide-charcoal/10">
          {coupons.map((c) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {c.code}{" "}
                  <span className="text-charcoal/50 font-normal">
                    · {c.type === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`}
                  </span>
                </p>
                <p className="text-xs text-charcoal/40">
                  {c.minOrderAmount > 0 && `Min order ₹${c.minOrderAmount} · `}
                  {c.maxDiscountAmount ? `Capped at ₹${c.maxDiscountAmount} · ` : ""}
                  {c.usageLimit ? `${c.usageCount}/${c.usageLimit} used` : `${c.usageCount} used`}
                  {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-charcoal/60">
                  <input type="checkbox" checked={c.isActive} onChange={() => toggleActive(c)} />
                  Active
                </label>
                <button className="text-red-600" onClick={() => deleteCoupon(c)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center p-6 z-20">
          <form onSubmit={saveCoupon} className="card p-6 w-full max-w-sm space-y-3">
            <h3 className="font-display text-xl mb-1">New Coupon</h3>
            <input
              className="input"
              placeholder="Code (e.g. WELCOME10)"
              required
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                className="input"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                <option value="PERCENT">% off</option>
                <option value="FLAT">₹ off (flat)</option>
              </select>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder={draft.type === "PERCENT" ? "10" : "100"}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </div>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Minimum order amount (optional)"
              value={draft.minOrderAmount}
              onChange={(e) => setDraft({ ...draft, minOrderAmount: e.target.value })}
            />
            {draft.type === "PERCENT" && (
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Max discount cap in ₹ (optional)"
                value={draft.maxDiscountAmount}
                onChange={(e) => setDraft({ ...draft, maxDiscountAmount: e.target.value })}
              />
            )}
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Usage limit (optional, blank = unlimited)"
              value={draft.usageLimit}
              onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })}
            />
            <div>
              <label className="text-xs text-charcoal/50 block mb-1">Expires on (optional)</label>
              <input
                className="input"
                type="date"
                value={draft.expiresAt}
                onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
