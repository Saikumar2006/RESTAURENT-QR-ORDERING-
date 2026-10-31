import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

const PERIODS = [
  { key: "MONTHLY", label: "Monthly", discountBadge: null },
  { key: "3_MONTHS", label: "3 Months", discountBadge: "Save 5%" },
  { key: "6_MONTHS", label: "6 Months", discountBadge: "Save 10%" },
  { key: "YEARLY", label: "Yearly", discountBadge: "Save 20%" },
];

function money(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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

export default function AdminRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { restoreSession } = useAuth();

  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Form State
  const [planKey, setPlanKey] = useState(searchParams.get("plan")?.toUpperCase() || "GROWTH");
  const [billingPeriod, setBillingPeriod] = useState("MONTHLY");
  const [mode, setMode] = useState("trial"); // "trial" | "paid"

  const [formData, setFormData] = useState({
    restaurantName: "",
    cuisineType: "",
    address: "",
    city: "",
    state: "",
    adminName: "",
    adminEmail: "",
    phone: "",
    adminPassword: "",
    confirmPassword: "",
  });

  // OTP Verification State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSession, setOtpSession] = useState("");
  const [phoneToken, setPhoneToken] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then((data) => {
        setCatalog(data);
        if (!data.trial?.available && data.checkoutAvailable) {
          setMode("paid");
        }
      })
      .catch((err) => setCatalogError(err.message || "Failed to load subscription catalog."))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const selectedPlan = catalog?.plans?.find((p) => p.key === planKey) || catalog?.plans?.[1] || {
    key: "GROWTH",
    name: "Growth",
    prices: { MONTHLY: 1199, "3_MONTHS": 3417, "6_MONTHS": 6475, YEARLY: 11510 },
  };

  const subtotal = selectedPlan.prices?.[billingPeriod] || 1199;
  const gst = Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = Math.round((subtotal + gst) * 100) / 100;

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Handle Step 2 -> Step 3 Validation
  function handleDetailsNext(e) {
    e.preventDefault();
    setError("");
    if (!formData.restaurantName.trim()) return setError("Restaurant name is required.");
    if (!formData.adminName.trim()) return setError("Owner name is required.");
    if (!formData.adminEmail.trim()) return setError("Business email is required.");
    if (!formData.phone.trim()) return setError("Mobile phone number is required.");
    setStep(3);
  }

  // Handle Sending Phone OTP
  async function handleSendOtp() {
    setError("");
    setOtpNotice("");
    setOtpSending(true);
    try {
      const res = await api.post("/subscriptions/onboarding/send-otp", {
        phone: formData.phone,
        email: formData.adminEmail,
      });
      setOtpSent(true);
      setOtpSession(res.verificationSession || "");
      if (res.mockCode) {
        setOtpNotice(`Instant Verification Code: ${res.mockCode} (Auto-filled for rapid setup)`);
        setOtpCode(res.mockCode);
      } else {
        setOtpNotice(res.message || "Verification code sent to your phone.");
      }
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setOtpSending(false);
    }
  }

  // Handle Verifying Phone OTP
  async function handleVerifyOtp() {
    setError("");
    setOtpVerifying(true);
    try {
      const res = await api.post("/subscriptions/onboarding/verify-otp", {
        phone: formData.phone,
        code: otpCode,
        verificationSession: otpSession,
      });
      if (res.verified) {
        setOtpVerified(true);
        setPhoneToken(res.phoneVerificationToken || "");
        setOtpNotice("Mobile number verified successfully!");
      }
    } catch (err) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  // Handle Step 3 -> Step 4 Validation
  function handleCredentialsNext(e) {
    e.preventDefault();
    setError("");
    if (!formData.adminPassword || formData.adminPassword.length < 10) {
      return setError("Password must be at least 10 characters.");
    }
    if (formData.adminPassword !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    setStep(4);
  }

  // Handle Final Submission (Trial or Paid)
  async function handleFinalSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      restaurantName: formData.restaurantName.trim(),
      cuisineType: formData.cuisineType.trim() || undefined,
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      adminName: formData.adminName.trim(),
      adminEmail: formData.adminEmail.trim().toLowerCase(),
      phone: formData.phone.trim(),
      adminPassword: formData.adminPassword,
      planKey,
      billingPeriod,
      phoneVerificationToken: phoneToken || undefined,
    };

    try {
      // Trial Mode
      if (mode === "trial") {
        const result = await api.post("/subscriptions/onboarding/trial", payload);
        if (result.token) {
          localStorage.setItem("qr_ordering_token", result.token);
          if (restoreSession) await restoreSession();
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/admin/login", { state: { notice: "Account created successfully! Please sign in." } });
        }
        return;
      }

      // Paid Mode via Razorpay
      const checkoutRes = await api.post("/subscriptions/onboarding/checkout", payload);
      
      // If Razorpay gateway is unconfigured on server, fall back to trial
      if (checkoutRes.provider === "unconfigured") {
        const trialResult = await api.post("/subscriptions/onboarding/trial", payload);
        if (trialResult.token) {
          localStorage.setItem("qr_ordering_token", trialResult.token);
          if (restoreSession) await restoreSession();
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/admin/login", { state: { notice: "Trial workspace active! Please sign in." } });
        }
        return;
      }

      const scriptLoaded = await loadCheckoutScript();
      if (!scriptLoaded) throw new Error("Payment gateway could not load. Please check your connection.");

      const options = {
        key: checkoutRes.keyId,
        amount: checkoutRes.amountMinor,
        currency: checkoutRes.currency,
        name: "Svaadya SaaS",
        description: `${selectedPlan.name} Plan (${billingPeriod})`,
        order_id: checkoutRes.providerOrderId,
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/subscriptions/onboarding/verify", {
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
            });
            if (verifyRes.token) {
              localStorage.setItem("qr_ordering_token", verifyRes.token);
              if (restoreSession) await restoreSession();
              navigate("/admin/dashboard", { replace: true });
            } else {
              navigate("/admin/login", { state: { notice: "Payment verified! Please sign in." } });
            }
          } catch (vErr) {
            setError(vErr.message || "Payment verification failed. Please contact support.");
            setSubmitting(false);
          }
        },
        prefill: {
          name: formData.adminName,
          email: formData.adminEmail,
          contact: formData.phone,
        },
        theme: { color: "#087f70" },
        modal: { ondismiss: () => setSubmitting(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || "Onboarding failed. Please try again.");
      setSubmitting(false);
    }
  }

  if (loadingCatalog) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f5f6f1]">
        <Spinner label="Loading packages and configuration..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f1] text-[#202925] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Top Header */}
        <header className="flex items-center justify-between pb-8 border-b border-[#dfe5df]">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-wide">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#087f70] font-display text-xl text-white shadow-md">
              S
            </span>
            <span className="font-display text-2xl tracking-wider text-[#121c17]">SVAADYA</span>
          </Link>
          <div className="text-sm">
            <span className="text-[#64716b]">Already registered? </span>
            <Link to="/admin/login" className="font-semibold text-[#087f70] hover:underline">
              Sign In
            </Link>
          </div>
        </header>

        {/* Step Progress Bar */}
        <div className="my-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto text-xs font-semibold">
            {[
              { num: 1, title: "Select Plan" },
              { num: 2, title: "Restaurant Details" },
              { num: 3, title: "Credentials" },
              { num: 4, title: "Checkout & Launch" },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm transition-all ${
                    step === s.num
                      ? "bg-[#087f70] text-white shadow-lg shadow-[#087f70]/30"
                      : step > s.num
                      ? "bg-[#d8ece4] text-[#087f70]"
                      : "bg-[#e5e9e5] text-[#86928b]"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </span>
                <span className={`hidden sm:inline ${step === s.num ? "text-[#087f70] font-bold" : "text-[#64716b]"}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* ================= STEP 1: SELECT PLAN ================= */}
        {step === 1 && (
          <div>
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#087f70]">Pricing & Packages</span>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl text-[#121c17]">Choose the right foundation.</h1>
              <p className="mt-2 text-sm text-[#64716b]">
                All plans include high-speed QR ordering, real-time live order kitchen flow, and zero commission on your orders.
              </p>

              {/* Billing Period Selector */}
              <div className="mt-6 inline-flex p-1 rounded-xl bg-[#e8ece7] border border-[#d3dbd3]">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setBillingPeriod(p.key)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      billingPeriod === p.key
                        ? "bg-white text-[#121c17] shadow-sm"
                        : "text-[#64716b] hover:text-[#121c17]"
                    }`}
                  >
                    {p.label}
                    {p.discountBadge && (
                      <span className="ml-1.5 rounded bg-[#e3f4ec] text-[#087f70] px-1.5 py-0.5 text-[10px] font-bold">
                        {p.discountBadge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              {(catalog?.plans || []).map((plan) => {
                const isSelected = planKey === plan.key;
                const isGrowth = plan.key === "GROWTH";
                const price = plan.prices?.[billingPeriod] || 799;

                return (
                  <div
                    key={plan.key}
                    onClick={() => setPlanKey(plan.key)}
                    className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-[#087f70] bg-white shadow-xl shadow-[#087f70]/10 ring-2 ring-[#087f70]/20"
                        : "border-[#dfe5df] bg-white/70 hover:border-[#b4c4b8] hover:bg-white shadow-sm"
                    }`}
                  >
                    {isGrowth && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#dfa16b] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        Most Popular
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f70]">{plan.name}</p>
                        <input
                          type="radio"
                          name="planSelection"
                          checked={isSelected}
                          onChange={() => setPlanKey(plan.key)}
                          className="h-4 w-4 text-[#087f70] focus:ring-[#087f70]"
                        />
                      </div>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold text-[#121c17]">
                          {money(price)}
                        </span>
                        <span className="text-xs text-[#64716b]">
                          / {billingPeriod.toLowerCase().replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#86928b]">Excl. 18% GST (added at billing review)</p>

                      <hr className="my-5 border-[#e8ece7]" />

                      <ul className="space-y-2.5 text-xs text-[#4b5550]">
                        {(plan.features || []).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#087f70] font-bold">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPlanKey(plan.key);
                        setStep(2);
                      }}
                      className={`mt-6 w-full rounded-xl py-2.5 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-[#087f70] text-white shadow-md hover:bg-[#066d60]"
                          : "bg-[#eef2ed] text-[#3e4843] hover:bg-[#dfe5df]"
                      }`}
                    >
                      {isSelected ? "Selected · Continue →" : "Select Plan"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-[#087f70] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#087f70]/20 hover:bg-[#066d60] transition-all"
              >
                Proceed with {selectedPlan.name} Plan →
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: RESTAURANT DETAILS ================= */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#087f70]">Restaurant Information</span>
              <h2 className="mt-1 font-display text-3xl text-[#121c17]">Tell us about your restaurant.</h2>
              <p className="mt-1 text-xs text-[#64716b]">This information sets up your tenant workspace and customer ordering header.</p>
            </div>

            <form onSubmit={handleDetailsNext} className="bg-white rounded-2xl border border-[#dfe5df] p-6 sm:p-8 shadow-sm space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Svaadya Bistro, Royal Curry"
                    value={formData.restaurantName}
                    onChange={(e) => updateField("restaurantName", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Cuisine / Category</label>
                  <input
                    type="text"
                    placeholder="e.g. North Indian, Cafe, Fast Food"
                    value={formData.cuisineType}
                    onChange={(e) => updateField("cuisineType", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Street Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 12 Main St, Jubilee Hills"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">State / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Telangana"
                    value={formData.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-[#edf2ed]">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#087f70] mb-2">Owner Contact</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Your full name"
                    value={formData.adminName}
                    onChange={(e) => updateField("adminName", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Business Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="owner@restaurant.com"
                    value={formData.adminEmail}
                    onChange={(e) => updateField("adminEmail", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#3e4843] mb-1">Mobile Phone (for OTP & alerts) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#64716b] hover:text-[#121c17]"
                >
                  ← Back to Plans
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#087f70] px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-[#066d60]"
                >
                  Next: Security & Verification →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 3: CREDENTIALS & PHONE OTP ================= */}
        {step === 3 && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#087f70]">Security & Verification</span>
              <h2 className="mt-1 font-display text-3xl text-[#121c17]">Secure your restaurant workspace.</h2>
              <p className="mt-1 text-xs text-[#64716b]">Create your master admin password and verify your mobile number.</p>
            </div>

            <form onSubmit={handleCredentialsNext} className="bg-white rounded-2xl border border-[#dfe5df] p-6 sm:p-8 shadow-sm space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#3e4843] mb-1">Create Admin Password *</label>
                <input
                  type="password"
                  required
                  minLength={10}
                  placeholder="Min 10 characters"
                  value={formData.adminPassword}
                  onChange={(e) => updateField("adminPassword", e.target.value)}
                  className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                />
                <span className="mt-1 block text-[11px] text-[#86928b]">Use at least 10 letters, numbers, and symbols.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3e4843] mb-1">Confirm Admin Password *</label>
                <input
                  type="password"
                  required
                  minLength={10}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  className="w-full rounded-xl border border-[#ccd5cd] px-3.5 py-2.5 text-sm focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70] outline-none"
                />
              </div>

              {/* Mobile Phone Verification Box */}
              <div className="rounded-xl border border-[#d8ece4] bg-[#f2f9f6] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#087f70]">Phone Verification</p>
                    <p className="text-[11px] text-[#4b5550]">Mobile: <span className="font-mono font-semibold">{formData.phone}</span></p>
                  </div>
                  {otpVerified ? (
                    <span className="rounded-full bg-[#1b8a5a] px-3 py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1">
                      ✓ Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="rounded-lg bg-[#087f70] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#066d60] disabled:bg-[#99b5a8]"
                    >
                      {otpSending ? "Sending code..." : otpSent ? "Resend Code" : "Send Verification Code"}
                    </button>
                  )}
                </div>

                {otpNotice && (
                  <p className="mt-2 text-xs font-medium text-[#087f70] bg-white/60 p-2 rounded-lg border border-[#c1e2d4]">
                    {otpNotice}
                  </p>
                )}

                {otpSent && !otpVerified && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-36 rounded-lg border border-[#ccd5cd] px-3 py-2 text-sm text-center font-mono tracking-widest focus:border-[#087f70] outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying || !otpCode}
                      className="rounded-lg bg-[#087f70] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#066d60] disabled:bg-[#99b5a8]"
                    >
                      {otpVerifying ? "Verifying..." : "Verify Code"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#64716b] hover:text-[#121c17]"
                >
                  ← Back to Details
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#087f70] px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-[#066d60]"
                >
                  Next: Review & Launch →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 4: REVIEW & LAUNCH ================= */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#087f70]">Order Review & Launch</span>
              <h2 className="mt-1 font-display text-3xl text-[#121c17]">Ready to open your workspace.</h2>
              <p className="mt-1 text-xs text-[#64716b]">Review your subscription details and start your restaurant workspace.</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#dfe5df] p-6 sm:p-8 shadow-sm space-y-6">
              {/* Setup Mode Selector */}
              <div className="rounded-xl bg-[#f7f9f6] p-4 border border-[#e2e8e2]">
                <p className="text-xs font-bold text-[#121c17] mb-2">Select Onboarding Activation:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      mode === "trial"
                        ? "border-[#087f70] bg-white ring-1 ring-[#087f70]"
                        : "border-[#ccd5cd] bg-white/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="onboardingMode"
                      checked={mode === "trial"}
                      onChange={() => setMode("trial")}
                      className="text-[#087f70] focus:ring-[#087f70]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#121c17]">14-Day Free Trial</p>
                      <p className="text-[11px] text-[#64716b]">No payment collected now</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      mode === "paid"
                        ? "border-[#087f70] bg-white ring-1 ring-[#087f70]"
                        : "border-[#ccd5cd] bg-white/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="onboardingMode"
                      checked={mode === "paid"}
                      onChange={() => setMode("paid")}
                      className="text-[#087f70] focus:ring-[#087f70]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#121c17]">Pay Now & Activate</p>
                      <p className="text-[11px] text-[#64716b]">Instant full subscription</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Order Invoice Breakdown */}
              <div className="rounded-xl border border-[#e5e9e5] p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[#121c17]">
                    {selectedPlan.name} Plan ({billingPeriod.toLowerCase().replace("_", " ")})
                  </span>
                  <span className="font-mono font-medium">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#64716b]">
                  <span>Applicable GST (18%)</span>
                  <span className="font-mono">{money(gst)}</span>
                </div>
                <hr className="border-[#edf2ed]" />
                <div className="flex justify-between text-base font-bold text-[#121c17]">
                  <span>Total Amount</span>
                  <span className="font-mono text-[#087f70] text-xl">{money(grandTotal)}</span>
                </div>
                {mode === "trial" && (
                  <p className="text-[11px] font-medium text-[#087f70] bg-[#eef8f3] p-2 rounded-lg text-center">
                    ✓ Free Trial Activated: You pay ₹0 today. Your first payment will be due after 14 days.
                  </p>
                )}
              </div>

              {/* Summary Details */}
              <div className="grid gap-2 text-xs text-[#4b5550] bg-[#fbfcfb] p-4 rounded-xl border border-[#eef2ed]">
                <p><strong>Restaurant:</strong> {formData.restaurantName} ({formData.cuisineType || "General"})</p>
                <p><strong>Location:</strong> {formData.city ? `${formData.city}, ${formData.state}` : "Premises to be set"}</p>
                <p><strong>Admin Owner:</strong> {formData.adminName} ({formData.adminEmail})</p>
                <p><strong>Mobile:</strong> {formData.phone} {otpVerified ? "✓ Verified" : ""}</p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#64716b] hover:text-[#121c17]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-[#087f70] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#087f70]/30 hover:bg-[#066d60] transition-all disabled:bg-[#99b5a8]"
                >
                  {submitting
                    ? "Setting up your restaurant..."
                    : mode === "trial"
                    ? "Start 14-Day Free Trial →"
                    : `Pay ${money(grandTotal)} & Launch →`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
