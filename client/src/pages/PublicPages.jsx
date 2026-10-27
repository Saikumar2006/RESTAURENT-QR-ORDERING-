import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const PERIODS = [["MONTHLY", "Monthly"], ["3_MONTHS", "Every 3 months"], ["6_MONTHS", "Every 6 months"], ["YEARLY", "Yearly"]];
const money = (amount, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

function PublicFrame({ eyebrow, title, children }) {
  return <main className="min-h-screen bg-[#f5f6f1] px-5 py-8 text-[#202925] sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="flex items-center justify-between"><Link to="/" className="flex items-center gap-2 font-semibold tracking-wide"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#087f70] font-display text-xl text-white">S</span>SVAADYA</Link><Link className="text-sm text-[#087f70] underline-offset-4 hover:underline" to="/admin/login">Restaurant sign in</Link></header>
    <section className="py-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#087f70]">{eyebrow}</p><h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">{title}</h1><div className="mt-8">{children}</div></section>
    <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#dfe5df] py-5 text-xs text-[#64716b]"><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></footer>
  </div></main>;
}

export function PricingPage() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/subscriptions/plans").then(setCatalog).catch((err) => setError(err.message)); }, []);
  return <PublicFrame eyebrow="Plans" title="A clear starting point for your restaurant.">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Plans could not be loaded: {error}</p>}
    {!catalog ? <p className="text-sm text-[#64716b]">Loading plan details…</p> : <>
      {!catalog.configuration.pricingConfigured && <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Subscription pricing is being configured. Checkout is disabled until final prices are published.</p>}
      <div className="grid gap-4 lg:grid-cols-3">{catalog.plans.map((plan, index) => <article key={plan.key} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${index === 1 ? "border-[#087f70] ring-1 ring-[#087f70]" : "border-[#dfe5df]"}`}>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087f70]">{plan.name}</p><h2 className="mt-3 font-display text-2xl">{index === 0 ? "The essentials" : index === 1 ? "Room to grow" : "A deeper toolkit"}</h2>
        <p className="mt-3 min-h-12 text-sm text-[#64716b]">{index === 0 ? "A clear home for menus, tables and orders." : index === 1 ? "More control for a growing restaurant team." : "Inventory tools and AI assisted menu entry when configured."}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">{PERIODS.map(([key, label]) => <div key={key} className="rounded-lg bg-[#f5f7f4] p-3"><span className="block text-[11px] text-[#64716b]">{label}</span><strong className="mt-1 block text-sm">{plan.prices[key] ? money(plan.prices[key], catalog.currency) : "Price pending"}</strong></div>)}</div>
        <ul className="mt-5 space-y-2 text-sm">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-[#087f70]">✓</span>{feature}</li>)}</ul>
        {catalog.checkoutAvailable || catalog.trial.available
          ? <Link to={`/onboarding/${plan.key.toLowerCase()}`} className="mt-auto rounded-lg bg-[#087f70] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#066c60]">{catalog.trial.available && catalog.checkoutAvailable ? "Choose plan option" : catalog.trial.available ? `${catalog.trial.days}-day trial` : "Choose plan"}</Link>
          : <button type="button" disabled className="mt-auto cursor-not-allowed rounded-lg bg-[#e6eae6] px-4 py-3 text-sm font-semibold text-[#737d76]">Not available yet</button>}
      </article>)}</div>
      <p className="mt-5 text-xs text-[#64716b]">Prices, trial length, taxes and billing terms will be shown before account creation. Restaurant order payments remain separate from Svaadya subscription billing.</p>
    </>}
  </PublicFrame>;
}

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

export function OnboardingPage() {
  const { planKey = "basic" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [mode, setMode] = useState("trial");
  const [form, setForm] = useState({ restaurantName: "", cuisineType: "", adminName: "", adminEmail: "", adminPassword: "", planKey: planKey.toUpperCase(), billingPeriod: "MONTHLY" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/subscriptions/plans").then(setCatalog).catch((err) => setError(err.message)); }, []);
  useEffect(() => setForm((current) => ({ ...current, planKey: planKey.toUpperCase() })), [planKey]);
  useEffect(() => { setMode(catalog?.trial.available ? "trial" : "paid"); }, [catalog]);
  useEffect(() => { if (location.state?.notice) setError(location.state.notice); }, [location.state]);
  const plan = catalog?.plans.find((item) => item.key === form.planKey);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "trial" && catalog?.trial.available) {
        const result = await api.post("/subscriptions/onboarding/trial", form);
        navigate("/onboarding/result", { state: { trial: true, restaurant: result.restaurant, days: catalog.trial.days } });
        return;
      }
      const order = await api.post("/subscriptions/onboarding/checkout", form);
      const loaded = await loadCheckoutScript();
      if (!loaded) throw new Error("Payment checkout could not load. Please retry.");
      const widget = new window.Razorpay({
        key: order.keyId, amount: order.amountMinor, currency: order.currency, order_id: order.providerOrderId,
        name: "Svaadya", description: `${form.planKey} restaurant subscription`,
        handler: async (response) => {
          try {
            const result = await api.post("/subscriptions/onboarding/verify", {
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
            });
            navigate("/onboarding/result", { state: { restaurant: result.restaurant, paid: true } });
          } catch (verifyError) { setError(verifyError.message); setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#087f70" },
      });
      widget.open();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return <PublicFrame eyebrow="Secure setup" title="Create your restaurant workspace.">
    {catalog?.trial.available && catalog?.checkoutAvailable && <fieldset className="mb-5 flex flex-wrap gap-4 rounded-xl border border-[#dfe5df] bg-white p-4 text-sm"><legend className="px-1 font-semibold">Choose setup</legend><label className="flex items-center gap-2"><input type="radio" name="onboarding-mode" checked={mode === "trial"} onChange={() => setMode("trial")} />{catalog.trial.days}-day trial</label><label className="flex items-center gap-2"><input type="radio" name="onboarding-mode" checked={mode === "paid"} onChange={() => setMode("paid")} />Pay now</label></fieldset>}
    {catalog?.trial.available && mode === "trial" ? <p className="mb-5 rounded-xl border border-[#b8dfd1] bg-[#ecf8f2] p-4 text-sm">Your configured trial lasts {catalog.trial.days} days. No payment is collected during trial setup.</p> : null}
    {!catalog?.trial.available && !catalog?.checkoutAvailable && <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">New checkout is temporarily unavailable while subscription prices and payment credentials are configured.</p>}
    <form className="grid gap-6 rounded-2xl border border-[#dfe5df] bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[1fr_320px]" onSubmit={submit}>
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Restaurant name<input className="input mt-1" required minLength="2" maxLength="100" value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} /></label>
        <label className="text-sm">Cuisine<input className="input mt-1" maxLength="60" value={form.cuisineType} onChange={(e) => setForm({ ...form, cuisineType: e.target.value })} /></label>
        <label className="text-sm">Plan<select className="input mt-1" value={form.planKey} onChange={(e) => setForm({ ...form, planKey: e.target.value })}>{catalog?.plans.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
        {(!catalog?.trial.available || mode === "paid") && <label className="text-sm sm:col-span-2">Billing period<select className="input mt-1" value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}>{PERIODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        <label className="text-sm">Account owner<input className="input mt-1" required minLength="2" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></label>
        <label className="text-sm">Email<input className="input mt-1" required type="email" autoComplete="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Password<input className="input mt-1" required type="password" minLength="10" maxLength="128" autoComplete="new-password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} /><span className="mt-1 block text-xs text-[#64716b]">Use at least 10 characters.</span></label>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{error}</p>}
        <button className="rounded-lg bg-[#087f70] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#95aaa2] sm:col-span-2" disabled={busy || !catalog || (mode === "trial" ? !catalog.trial.available : !catalog.checkoutAvailable)}>{busy ? "Preparing secure setup…" : mode === "trial" && catalog?.trial.available ? "Start configured trial" : "Continue to secure payment"}</button>
      </div>
      <aside className="rounded-xl bg-[#f4f7f3] p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#087f70]">Your selection</p><h2 className="mt-2 font-display text-2xl">{plan?.name || "Restaurant plan"}</h2><p className="mt-2 text-sm text-[#64716b]">{mode === "trial" && catalog?.trial.available ? `${catalog.trial.days}-day trial` : plan?.prices[form.billingPeriod] ? `${money(plan.prices[form.billingPeriod])} · ${form.billingPeriod.toLowerCase().replaceAll("_", " ")}` : "Price will be set before checkout"}</p><p className="mt-5 text-xs leading-5 text-[#64716b]">Restaurant food-order payments use their own payment records. Svaadya subscription billing is handled separately.</p></aside>
    </form>
  </PublicFrame>;
}

export function OnboardingResultPage() {
  const { state } = useLocation();
  return <PublicFrame eyebrow="Setup status" title={state?.trial ? "Your trial workspace is ready." : state?.paid ? "Payment verified. Your workspace is ready." : "Onboarding status is unavailable."}>
    {state?.restaurant ? <div className="max-w-2xl rounded-2xl border border-[#b8dfd1] bg-white p-6"><p className="text-sm text-[#64716b]">Restaurant</p><p className="mt-1 text-xl font-semibold">{state.restaurant.name}</p>{state.trial && <p className="mt-3 text-sm">Your configured trial runs for {state.days} days.</p>}<Link className="mt-5 inline-flex rounded-lg bg-[#087f70] px-4 py-3 text-sm font-semibold text-white" to="/admin/login">Sign in to your workspace</Link></div> : <p className="max-w-xl text-sm leading-6 text-[#64716b]">If a payment completed, contact support with the payment provider receipt so the account can be reconciled. No restaurant account is created until the server verifies payment.</p>}
  </PublicFrame>;
}

export function AboutPage() {
  return <PublicFrame eyebrow="About Svaadya" title="Restaurant operations in one connected workspace."><div className="max-w-3xl space-y-5 text-base leading-7 text-[#56645c]"><p>Svaadya provides tools for restaurant teams to manage menus, tables, orders, staff and service operations through a browser-based workspace.</p><p>Capabilities depend on the deployed configuration. Marketplace connections, payment providers, AI features and subscription plans should only be used when their authorized provider access and credentials are configured.</p><Link className="inline-flex rounded-lg bg-[#087f70] px-4 py-3 text-sm font-semibold text-white" to="/pricing">View plan availability</Link></div></PublicFrame>;
}

export function ContactPage() {
  const [details, setDetails] = useState(null);
  useEffect(() => { api.get("/subscriptions/plans").then(setDetails).catch(() => setDetails({ configuration: {} })); }, []);
  return <PublicFrame eyebrow="Contact" title="Get in touch with the Svaadya team."><div className="max-w-2xl rounded-2xl border border-[#dfe5df] bg-white p-6"><p className="text-sm leading-6 text-[#64716b]">{details?.configuration?.legalDetailsConfigured ? "Use the published service contact for account questions." : "Support contact details have not been configured by the service owner yet."}</p>{details?.configuration?.legalDetailsConfigured && <p className="mt-3 text-sm">For account questions, email <a className="text-[#087f70] underline" href={`mailto:${details.companySupportEmail}`}>{details.companySupportEmail}</a>.</p>}</div></PublicFrame>;
}

export function LegalPage({ kind }) {
  const [details, setDetails] = useState(null);
  useEffect(() => { api.get("/subscriptions/plans").then(setDetails).catch(() => setDetails({ configuration: {} })); }, []);
  const title = kind === "privacy" ? "Privacy information" : "Terms of service";
  const configured = details?.configuration?.legalDetailsConfigured;
  return <PublicFrame eyebrow="Legal" title={title}><div className="max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-6"><p className="font-semibold text-amber-950">{configured ? "Legal text requires owner review before publication." : "Legal details are not configured."}</p><p className="mt-3 text-sm leading-6 text-amber-950/80">The service owner must provide applicable jurisdictions, data retention terms and approved policy wording. This page does not invent company details or present draft language as approved legal terms.</p>{configured && <dl className="mt-5 grid gap-3 text-sm text-amber-950/80"><div><dt className="font-semibold">Legal entity</dt><dd>{details.companyLegalName}</dd></div><div><dt className="font-semibold">Registered address</dt><dd>{details.companyAddress}</dd></div><div><dt className="font-semibold">Registration number</dt><dd>{details.companyRegistrationNumber}</dd></div><div><dt className="font-semibold">Support</dt><dd>{details.companySupportEmail}</dd></div></dl>}</div></PublicFrame>;
}
