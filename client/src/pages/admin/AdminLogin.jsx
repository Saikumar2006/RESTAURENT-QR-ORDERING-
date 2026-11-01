import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/AuthContext.jsx";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { ErrorBanner } from "../../components/Ui.jsx";
import {
  ChefHatIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronRightIcon,
  CheckIcon,
} from "../../components/UiIcons.jsx";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const googleErrorMessages = {
  account_not_found: "No existing restaurant account uses this Google email. Ask your administrator to create one or sign in with email and password.",
  ambiguous_account: "Multiple restaurant accounts use this Google email. Sign in with email and password or contact your administrator.",
  inactive_account: "This restaurant account is inactive. Contact your administrator.",
  invalid_state: "Google sign-in expired or could not be verified. Please try again.",
  cancelled: "Google sign-in was cancelled.",
  not_configured: "Google sign-in is not configured on the server yet.",
  oauth_failed: "Google sign-in could not be completed. Please try again.",
};

export default function AdminLogin() {
  const { user, login } = useAuth();
  const { admin, setAdminFromLogin } = usePlatformAuth();
  const navigate = useNavigate();
  const { state, hash } = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(state?.notice || null);
  const [submitting, setSubmitting] = useState(false);
  const [multipleRestaurants, setMultipleRestaurants] = useState(null);

  useEffect(() => {
    if (admin) {
      navigate("/super-admin/dashboard", { replace: true });
    } else if (user) {
      const destination = user.role === "STAFF" ? "/admin/orders" : "/admin";
      navigate(destination, { replace: true });
    }
  }, [admin, user, navigate]);

  useEffect(() => {
    const errorCode = new URLSearchParams(hash.slice(1)).get("google_error");
    if (errorCode) setError(googleErrorMessages[errorCode] || googleErrorMessages.oauth_failed);
  }, [hash]);

  function beginGoogleLogin() {
    window.location.assign(`${API_ORIGIN}/api/auth/google`);
  }

  async function handleLoginWithSlug(slug) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password, slug);
      if (result.accountType === "platform") {
        if (setAdminFromLogin) setAdminFromLogin(result.admin);
        navigate(result.redirectTo || "/super-admin/dashboard", { replace: true });
        return;
      }
      let destination = (state?.from?.pathname && state.from.pathname !== "/admin/login" && state.from.pathname !== "/login")
        ? state.from.pathname
        : (result.redirectTo || "/admin");
      if (result.user?.role === "STAFF" && (destination === "/admin" || destination === "/admin/dashboard")) {
        destination = "/admin/orders";
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setMultipleRestaurants(null);
    try {
      const result = await login(email, password);
      if (result.accountType === "platform") {
        if (setAdminFromLogin) setAdminFromLogin(result.admin);
        navigate(result.redirectTo || "/super-admin/dashboard", { replace: true });
        return;
      }
      let destination = (state?.from?.pathname && state.from.pathname !== "/admin/login" && state.from.pathname !== "/login")
        ? state.from.pathname
        : (result.redirectTo || "/admin");
      if (result.user?.role === "STAFF" && (destination === "/admin" || destination === "/admin/dashboard")) {
        destination = "/admin/orders";
      }
      navigate(destination, { replace: true });
    } catch (err) {
      if (err.details?.restaurants && err.details.restaurants.length > 0) {
        setMultipleRestaurants(err.details.restaurants);
      } else {
        setError(err.message || "Invalid email or password");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F8F7] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* LEFT COLUMN: Visual Brand Card */}
        <div className="md:col-span-5 p-8 rounded-2xl bg-[#004C46] text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#087F73]/40 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#D96724]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#087F73] flex items-center justify-center text-white shadow-md">
                <ChefHatIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white">Svaadya</span>
                <span className="block text-[9px] uppercase tracking-widest text-[#A3C7C2] font-semibold">Restaurant SaaS</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Welcome Back to Your Kitchen Hub</h2>
            <p className="text-xs text-[#A3C7C2] leading-relaxed mb-6">
              Sign in to manage live tables, view guest orders, configure your digital menu, and monitor daily revenue.
            </p>

            <div className="p-3.5 rounded-xl bg-white/[0.08] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs text-white">
                <CheckIcon className="w-4 h-4 text-[#16A394]" />
                <span>Multi-tenant Restaurant Isolation</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white">
                <CheckIcon className="w-4 h-4 text-[#16A394]" />
                <span>Role-Based Permissions (RBAC)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white">
                <CheckIcon className="w-4 h-4 text-[#16A394]" />
                <span>Live Socket Order Streaming</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/10 text-xs text-[#A3C7C2]">
            <span>Need a platform admin account? </span>
            <Link to="/platform/login" className="font-semibold text-white hover:text-[#16A394] transition underline">
              Platform Login →
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Sign In Form */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-[#E5ECE9] p-6 sm:p-10 shadow-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#172B2A]">Sign in to your restaurant</h1>
            <p className="text-xs text-[#788582] mt-1">Enter your account credentials to access your workspace.</p>
          </div>

          {notice && (
            <div className="bg-[#EAF7EE] border border-[#269B67]/30 text-[#269B67] text-xs rounded-lg px-4 py-3 mb-4">
              {notice}
            </div>
          )}

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Multiple Restaurants Chooser */}
          {multipleRestaurants ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#FFF8E7] border border-[#E7A13A]/30">
                <p className="text-xs font-bold text-[#E7A13A]">Multiple Restaurant Memberships Found</p>
                <p className="text-[11px] text-[#788582] mt-0.5">
                  Select which restaurant workspace you want to enter:
                </p>
              </div>

              <div className="space-y-2">
                {multipleRestaurants.map((rest) => (
                  <button
                    key={rest.slug}
                    type="button"
                    onClick={() => handleLoginWithSlug(rest.slug)}
                    disabled={submitting}
                    className="w-full p-3.5 rounded-xl border border-[#E5ECE9] bg-white hover:border-[#087F73] hover:bg-[#E7F5F1]/30 transition flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#172B2A]">{rest.name}</p>
                      <p className="text-[10px] text-[#788582]">Workspace: {rest.slug}</p>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-[#087F73]" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setMultipleRestaurants(null)}
                className="btn-secondary w-full text-xs"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#172B2A]">
                    Password
                  </label>
                  <span className="text-[11px] text-[#788582]">Forgot password? Ask your manager</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {submitting ? "Signing in..." : "Sign in to Workspace"}
                </button>
              </div>

              {/* Google Sign In option */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5ECE9]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-[#9CA8A5]">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={beginGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-[#E5ECE9] bg-white text-xs font-semibold text-[#172B2A] hover:bg-slate-50 transition shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="pt-4 text-center text-xs text-[#788582]">
                <span>Don't have a restaurant account? </span>
                <Link to="/admin/register" className="font-semibold text-[#087F73] hover:underline">
                  Register new restaurant
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
