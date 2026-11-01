import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Spinner, ErrorBanner, PageHeader } from "../../components/Ui.jsx";
import { CheckIcon, CalendarIcon } from "../../components/UiIcons.jsx";

const periods = [
  ["MONTHLY", "Monthly (Billed Monthly)"],
  ["3_MONTHS", "3 Months (Save 5%)"],
  ["6_MONTHS", "6 Months (Save 10%)"],
  ["YEARLY", "Yearly (Save 20%)"],
];

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
    try {
      setData(await api.get("/subscriptions/current"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const subscription = data?.subscription;
  const currentPlan = data?.catalog?.plans?.find((p) => p.key === subscription?.planKey);
  const amount = subscription && currentPlan?.prices?.[period];

  async function renew() {
    setWorking(true);
    setError("");
    setSaved(false);
    try {
      const order = await api.post("/subscriptions/renewal", { billingPeriod: period });
      if (!await loadCheckoutScript()) throw new Error("Payment checkout could not load. Please retry.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountMinor,
        currency: order.currency,
        order_id: order.providerOrderId,
        name: "Svaadya SaaS",
        description: `Renew ${order.planKey} Subscription`,
        handler: async (response) => {
          try {
            await api.post("/subscriptions/onboarding/verify", {
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
            });
            setSaved(true);
            await refresh();
            setWorking(false);
          } catch (err) {
            setError(err.message);
            setWorking(false);
          }
        },
        modal: { ondismiss: () => setWorking(false) },
        theme: { color: "#004C46" },
      });
      checkout.open();
    } catch (err) {
      setError(err.message);
      setWorking(false);
    }
  }

  if (!data && !error) return <Spinner label="Loading SaaS subscription status..." />;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Subscription & Billing"
        description="Manage your Svaadya SaaS subscription, review active trial dates, and extend your plan renewal."
        actions={
          <button type="button" onClick={refresh} className="btn-secondary text-xs">
            Refresh Status
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      {saved && (
        <div className="p-3.5 rounded-xl bg-[#EAF7EE] border border-[#269B67]/30 text-xs font-semibold text-[#269B67] flex items-center gap-2">
          <span>✓</span>
          <span>Subscription renewal verified and applied successfully!</span>
        </div>
      )}

      {subscription ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Plan Card (7 Cols) */}
          <div className="lg:col-span-7 card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F73]">
                  Active SaaS Tier
                </span>
                <h2 className="text-2xl font-bold text-[#172B2A] mt-1">{subscription.planKey} Plan</h2>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                subscription.status === "ACTIVE"
                  ? "bg-[#EAF7EE] text-[#269B67]"
                  : subscription.status === "TRIALING"
                  ? "bg-[#E7F5F1] text-[#087F73]"
                  : "bg-[#FFF8E7] text-[#E7A13A]"
              }`}>
                {subscription.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9]">
                <p className="text-[10px] font-semibold text-[#788582]">Current Billing Period</p>
                <p className="font-bold text-[#172B2A] text-sm mt-1">{subscription.billingPeriod}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9]">
                <p className="text-[10px] font-semibold text-[#788582]">Rate Amount</p>
                <p className="font-bold text-[#172B2A] text-sm mt-1">
                  {subscription.currency} {Number(subscription.amount).toLocaleString("en-IN")}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9]">
                <p className="text-[10px] font-semibold text-[#788582]">Current Period Ends</p>
                <p className="font-bold text-[#172B2A] text-sm mt-1">
                  {new Date(subscription.endsAt).toLocaleDateString()}
                </p>
              </div>

              {subscription.trialEndsAt && (
                <div className="p-3 rounded-xl bg-[#EAF7EE] border border-[#269B67]/30">
                  <p className="text-[10px] font-semibold text-[#269B67]">Free Trial Concludes</p>
                  <p className="font-bold text-[#172B2A] text-sm mt-1">
                    {new Date(subscription.trialEndsAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 text-[11px] text-[#788582]">
              Includes multi-table QR ordering, unlimited digital menu edits, kitchen operations queue, staff RBAC accounts, and daily revenue reporting.
            </div>
          </div>

          {/* Renewal Box (5 Cols) */}
          <div className="lg:col-span-5 card p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#172B2A]">Extend & Renew Subscription</h3>
            <p className="text-xs text-[#788582]">
              Choose your renewal billing duration to continue uninterrupted operations.
            </p>

            {data?.catalog?.configuration?.checkoutAvailable ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Select Renewal Duration
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="input text-xs"
                  >
                    {periods.map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9] flex items-center justify-between">
                  <span className="text-xs text-[#788582]">Total Renewal Due:</span>
                  <span className="text-base font-bold text-[#004C46]">
                    {amount ? `${subscription.currency} ${Number(amount).toLocaleString("en-IN")}` : "Unavailable"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={renew}
                  disabled={working || !amount}
                  className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{working ? "Launching Razorpay..." : "Continue to Secure Checkout"}</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#FFF8E7] border border-[#E7A13A]/30 text-xs text-[#788582]">
                Renewal checkout is operating under unconfigured online payments. Contact your platform administrator to activate automated renewals.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center max-w-lg mx-auto space-y-2">
          <h3 className="text-base font-bold text-[#172B2A]">Restaurant Workspace Active</h3>
          <p className="text-xs text-[#788582]">
            This restaurant is operating under standard legacy trial access.
          </p>
        </div>
      )}
    </div>
  );
}
