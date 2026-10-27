import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

const periods = [["MONTHLY", "Monthly"], ["3_MONTHS", "3 months"], ["6_MONTHS", "6 months"], ["YEARLY", "Yearly"]];
function loadCheckoutScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function AdminSubscription() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("MONTHLY");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [saved, setSaved] = useState(false);
  async function refresh() {
    setError("");
    try { setData(await api.get("/subscriptions/current")); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { refresh(); }, []);
  const subscription = data?.subscription;
  const amount = subscription && data?.catalog?.plans.find((plan) => plan.key === subscription.planKey)?.prices[period];

  async function renew() {
    setWorking(true); setError(""); setSaved(false);
    try {
      const order = await api.post("/subscriptions/renewal", { billingPeriod: period });
      if (!await loadCheckoutScript()) throw new Error("Payment checkout could not load. Please retry.");
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amountMinor, currency: order.currency, order_id: order.providerOrderId,
        name: "Svaadya", description: `Renew ${order.planKey} subscription`,
        handler: async (response) => {
          try {
            await api.post("/subscriptions/onboarding/verify", { providerOrderId: response.razorpay_order_id, providerPaymentId: response.razorpay_payment_id, providerSignature: response.razorpay_signature });
            setSaved(true); await refresh(); setWorking(false);
          } catch (err) { setError(err.message); setWorking(false); }
        },
        modal: { ondismiss: () => setWorking(false) },
        theme: { color: "#087f70" },
      });
      checkout.open();
    } catch (err) { setError(err.message); setWorking(false); }
  }

  if (!data && !error) return <div className="p-8"><Spinner label="Loading subscription…" /></div>;
  return <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
    <header className="page-header"><div><p className="section-eyebrow">ACCOUNT</p><h1 className="page-title">Subscription</h1><p className="page-description">Manage Svaadya billing separately from restaurant order payments.</p></div><button className="btn-secondary" onClick={refresh}>Refresh</button></header>
    {error && <ErrorBanner message={error} />}{saved && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Renewal verified and applied.</p>}
    {subscription ? <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <article className="rounded-xl border border-[#e3e8e3] bg-white p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#087f70]">Current plan</p><h2 className="mt-2 font-display text-3xl">{subscription.planKey}</h2><p className="mt-2 text-sm text-charcoal/60">Status: <strong>{subscription.status}</strong></p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-charcoal/45">Billing period</dt><dd className="mt-1 text-sm">{subscription.billingPeriod}</dd></div><div><dt className="text-xs text-charcoal/45">Amount</dt><dd className="mt-1 text-sm">{subscription.currency} {Number(subscription.amount).toLocaleString("en-IN")}</dd></div><div><dt className="text-xs text-charcoal/45">Current period ends</dt><dd className="mt-1 text-sm">{new Date(subscription.endsAt).toLocaleDateString()}</dd></div>{subscription.trialEndsAt && <div><dt className="text-xs text-charcoal/45">Trial ends</dt><dd className="mt-1 text-sm">{new Date(subscription.trialEndsAt).toLocaleDateString()}</dd></div>}</dl></article>
      <aside className="rounded-xl border border-[#e3e8e3] bg-white p-6"><h2 className="text-sm font-semibold">Renew subscription</h2>{data.catalog.configuration.checkoutAvailable ? <><label className="mt-4 block text-sm">Billing period<select className="input mt-1" value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p className="mt-3 text-sm text-charcoal/60">{amount ? `${subscription.currency} ${Number(amount).toLocaleString("en-IN")}` : "Price unavailable"}</p><button className="btn-primary mt-4 w-full" onClick={renew} disabled={working || !amount}>{working ? "Opening secure checkout…" : "Continue to payment"}</button></> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Renewal checkout is unavailable until the service owner configures prices and subscription payment credentials.</p>}</aside>
    </section> : <section className="rounded-xl border border-[#e3e8e3] bg-white p-6"><h2 className="font-display text-2xl">Existing restaurant account</h2><p className="mt-2 text-sm text-charcoal/60">No subscription record is attached to this workspace. Existing accounts remain available while the owner configures billing migration policy.</p></section>}
  </div>;
}
