import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";
import { LanguageSwitcher } from "../../i18n.jsx";
import {
  ChefHatIcon,
  SvaadyaLogo,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  OrdersIcon,
  PaymentsIcon,
  StaffIcon,
  ReportsIcon,
} from "../../components/UiIcons.jsx";

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
    termsAgreed: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        if (!data.trial?.available) {
          setMode("paid");
        } else if (!data.checkoutAvailable) {
          setMode("trial");
        }
      })
      .catch((err) => setError(err.message || "Failed to load subscription catalog."))
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

  // Step 1 -> Step 2 Validation (Restaurant details)
  function handleRestaurantNext(e) {
    e.preventDefault();
    setError("");
    if (!formData.restaurantName.trim()) return setError("Please enter your restaurant name.");
    if (!formData.termsAgreed) return setError("Please accept the terms and conditions to proceed.");
    setStep(2);
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
        setOtpNotice(`Instant Verification Code: ${res.mockCode}`);
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

  // Step 2 -> Step 3 Validation (Owner details & Password)
  function handleOwnerNext(e) {
    e.preventDefault();
    setError("");
    if (!formData.adminName.trim()) return setError("Please enter the owner's full name.");
    if (!formData.adminEmail.trim()) return setError("Please enter a valid business email.");
    if (!formData.phone.trim()) return setError("Please enter your mobile phone number.");
    if (!formData.adminPassword || formData.adminPassword.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (formData.adminPassword !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    setStep(3);
  }

  // Final Submission (Trial or Paid)
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
      if (!catalog?.checkoutAvailable) {
        throw new Error("Online payment gateway is not yet configured. Please contact support at svaadyarestro@gmail.com or start with a free trial.");
      }

      const checkoutRes = await api.post("/subscriptions/onboarding/checkout", payload);
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
            setError(vErr.message || "Payment verification failed. Please contact support at svaadyarestro@gmail.com.");
          }
        },
        prefill: {
          name: formData.adminName,
          email: formData.adminEmail,
          contact: formData.phone,
        },
        theme: { color: "#4F46E5" },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setError(err.message || "Registration failed. Please check details.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCatalog) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]"><Spinner label="Loading Svaadya registration..." /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="language-switcher-dock z-20 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm"><LanguageSwitcher /></div>
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* LEFT SIDE: Brand & Value Proposition matching screenshot */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white shadow-2xl relative overflow-hidden min-h-[580px] border border-white/10">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Logo */}
            <div className="mb-8">
              <SvaadyaLogo variant="light" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3 tracking-tight">
              Start Your Restaurant Journey with Svaadya
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed mb-8">
              Join leading dining establishments streamlining their table operations, digital QR orders, and real-time revenue analytics.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-4">
              {[
                { icon: OrdersIcon, title: "Digital Menu & QR Ordering", desc: "Contactless ordering with zero waiting times" },
                { icon: PaymentsIcon, title: "Secure Payments", desc: "Instant UPI, cards, and automated reconciliation" },
                { icon: StaffIcon, title: "Staff & Shift Management", desc: "Role-based controls for kitchen, captains & cashiers" },
                { icon: ReportsIcon, title: "Reports & Analytics", desc: "Actionable revenue trends and top seller insights" },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{feat.title}</p>
                      <p className="text-[11px] text-[#A3C7C2]">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Social Proof */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-[#A3C7C2]">
            <span>Already have an account?</span>
            <Link to="/admin/login" className="font-semibold text-white hover:text-[#16A394] transition underline">
              Sign In →
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE: 3-Step Interactive Registration Form Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5ECE9] p-6 sm:p-10 shadow-lg relative">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-[#172B2A]">Create Your Restaurant Account</h1>
            <p className="text-xs text-[#788582] mt-1">Set up your multi-tenant workspace in under 2 minutes.</p>
          </div>

          {/* 3-Step Progress Indicator */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#E5ECE9] -translate-y-1/2 z-0" />
            {[
              { num: 1, label: "Restaurant" },
              { num: 2, label: "Owner & Auth" },
              { num: 3, label: "Subscription" },
            ].map((s) => {
              const isPassed = step > s.num;
              const isCurrent = step === s.num;
              return (
                <div key={s.num} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPassed
                        ? "bg-indigo-600 text-white shadow-xs"
                        : isCurrent
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-xs"
                        : "bg-white text-slate-400 border-2 border-slate-200"
                    }`}
                  >
                    {isPassed ? <CheckIcon className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-[11px] font-semibold mt-1.5 ${isCurrent ? "text-indigo-600" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

          {/* STEP 1: Restaurant Details */}
          {step === 1 && (
            <form onSubmit={handleRestaurantNext} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Restaurant Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spice Garden Restaurant"
                  value={formData.restaurantName}
                  onChange={(e) => updateField("restaurantName", e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">Cuisine Type</label>
                  <input
                    type="text"
                    placeholder="e.g. South Indian, Continental"
                    value={formData.cuisineType}
                    onChange={(e) => updateField("cuisineType", e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Karnataka"
                    value={formData.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="Street / Area"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-[#788582]">
                  <input
                    type="checkbox"
                    checked={formData.termsAgreed}
                    onChange={(e) => updateField("termsAgreed", e.target.checked)}
                    className="mt-0.5 rounded text-[#004C46] focus:ring-[#087F73]"
                  />
                  <span>
                    I agree to the <Link to="/terms" target="_blank" className="text-[#087F73] underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="text-[#087F73] underline">Privacy Policy</Link>.
                  </span>
                </label>
              </div>

              <div className="pt-4">
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <span>Continue to Owner Details</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Owner Details & Password */}
          {step === 2 && (
            <form onSubmit={handleOwnerNext} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Owner Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sai Kumar"
                  value={formData.adminName}
                  onChange={(e) => updateField("adminName", e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Business Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@restaurant.com"
                  value={formData.adminEmail}
                  onChange={(e) => updateField("adminEmail", e.target.value)}
                  className="input"
                />
              </div>

              {/* Mobile Phone + OTP verification */}
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs text-[#788582] font-semibold">+91</span>
                    <input
                      type="tel"
                      required
                      placeholder="98765 43210"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="input pl-11"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending || !formData.phone.trim()}
                    className="btn-secondary text-xs shrink-0"
                  >
                    {otpSending ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                  </button>
                </div>
                {otpNotice && <p className="mt-1 text-xs text-[#087F73] font-medium">{otpNotice}</p>}
              </div>

              {otpSent && !otpVerified && (
                <div className="p-3 rounded-lg bg-[#E7F5F1] border border-[#087F73]/20 space-y-2">
                  <label className="block text-xs font-semibold text-[#004C46]">
                    Enter OTP Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="input bg-white text-center tracking-widest font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying || !otpCode}
                      className="btn-primary text-xs shrink-0"
                    >
                      {otpVerifying ? "Verifying..." : "Verify"}
                    </button>
                  </div>
                </div>
              )}

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Min 8 characters"
                      value={formData.adminPassword}
                      onChange={(e) => updateField("adminPassword", e.target.value)}
                      className="input pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-[#788582] hover:text-[#172B2A]"
                    >
                      {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Re-enter password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField("confirmPassword", e.target.value)}
                      className="input pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-[#788582] hover:text-[#172B2A]"
                    >
                      {showConfirmPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button type="submit" className="btn-primary flex items-center gap-1.5 text-xs">
                  <span>Continue to Plan</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Plan & Subscription Selection */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-5">
              {/* Plan Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {catalog?.plans?.map((plan) => {
                  const isSelected = planKey === plan.key;
                  const price = plan.prices?.[billingPeriod] || 0;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => setPlanKey(plan.key)}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        isSelected
                          ? "border-[#087F73] bg-[#E7F5F1]/50 ring-2 ring-[#087F73]"
                          : "border-[#E5ECE9] bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className="text-xs font-bold text-[#172B2A]">{plan.name}</p>
                      <p className="text-lg font-bold text-[#004C46] mt-1">₹{price}</p>
                      <p className="text-[10px] text-[#788582] mt-0.5">per {billingPeriod.toLowerCase()}</p>
                    </button>
                  );
                })}
              </div>

              {/* Billing Period Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {PERIODS.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => setBillingPeriod(period.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                      billingPeriod === period.key
                        ? "bg-[#004C46] text-white"
                        : "bg-[#F5F8F7] text-[#788582] hover:bg-slate-200"
                    }`}
                  >
                    {period.label} {period.discountBadge && `(${period.discountBadge})`}
                  </button>
                ))}
              </div>

              {/* Trial vs Paid Toggle */}
              {catalog?.trial?.available && (
                <div className="p-3.5 rounded-xl bg-[#EAF7EE] border border-[#269B67]/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#269B67]">
                      🎉 {catalog.trial.durationDays}-Day Free Trial Included
                    </p>
                    <p className="text-[11px] text-[#788582]">
                      Zero charges today. Explore all enterprise features without commitment.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#004C46]">
                    <input
                      type="radio"
                      name="onboardingMode"
                      checked={mode === "trial"}
                      onChange={() => setMode("trial")}
                      className="text-[#004C46] focus:ring-[#087F73]"
                    />
                    <span>Start Free Trial</span>
                  </label>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 rounded-xl bg-[#F5F8F7] border border-[#E5ECE9] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#788582]">
                  <span>Plan: {selectedPlan.name} ({billingPeriod})</span>
                  <span>{mode === "trial" ? "Free Trial" : money(subtotal)}</span>
                </div>
                {mode === "paid" && (
                  <>
                    <div className="flex justify-between text-[#788582]">
                      <span>GST (18%)</span>
                      <span>{money(gst)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#172B2A] pt-2 border-t border-[#E5ECE9] text-sm">
                      <span>Total Due Today</span>
                      <span>{money(grandTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex items-center justify-center gap-2 text-xs flex-1"
                >
                  {submitting ? (
                    "Processing..."
                  ) : mode === "trial" ? (
                    "Complete Registration & Launch Workspace"
                  ) : (
                    `Pay ${money(grandTotal)} & Start`
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
