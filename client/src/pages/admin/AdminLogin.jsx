import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/AuthContext.jsx";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { ErrorBanner } from "../../components/Ui.jsx";

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
  const [error, setError] = useState(null);
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
    <div className="restaurant-auth min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block rounded-[32px] border border-white/15 bg-[#111814]/50 p-8 shadow-[0_30px_80px_rgba(8,15,12,0.42)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F7C873]">Restaurant Dashboard</p>
          <h1 className="mt-4 max-w-md font-display text-5xl leading-tight text-white">Welcome back to your restaurant.</h1>
          <p className="mt-5 max-w-md text-base text-[#edf2ed]/75">
            Manage orders, tables, menu updates, and live customer flow from one beautiful control center.
          </p>

          <div className="mt-8 grid max-w-md gap-3 text-sm text-[#edf2ed]/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Live order queue</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Smart table management</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Faster customer checkout</div>
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="glass-panel rounded-[28px] p-6 shadow-[0_24px_70px_rgba(19,26,22,0.2)] sm:p-7">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#087f70]">Restaurant Dashboard</p>
              <h2 className="mt-3 font-display text-3xl text-charcoal">Welcome back</h2>
            </div>

            <button type="button" className="google-button w-full" onClick={beginGoogleLogin} disabled={submitting}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.39a4.61 4.61 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.97-4.3 2.97-7.32Z"/>
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.24-2.5c-.9.6-2.05.96-3.37.96-2.6 0-4.8-1.76-5.58-4.13H.74v2.62A10 10 0 0 0 12 22Z"/>
                  <path fill="#FBBC05" d="M6.42 19.89A6 6 0 0 1 6 17.1V14.5H2.8A10 10 0 0 0 2 12c0-1.6.38-3.12 1.07-4.5L6.42 10V7.78A7.98 7.98 0 0 1 12 5.8c1.37 0 2.6.38 3.68 1.13l2.77-2.77A9.97 9.97 0 0 0 12 2a10 10 0 0 0-9.2 5.5l3.62 2.8A6.03 6.03 0 0 1 12 8.4c1.8 0 3.46.67 4.7 1.77l2.83-2.83A9.95 9.95 0 0 0 12 2a10 10 0 0 0-9.2 5.5L6.42 10a6 6 0 0 1 11.12 0l3.62-2.8A10 10 0 0 0 12 2c5.52 0 10 4.48 10 10 0 1.02-.12 2-.36 2.96l-2.33-1.7A9.94 9.94 0 0 1 12 22Z" opacity="0.12"/>
                  <path fill="#EA4335" d="M12 8.4c1.8 0 3.46.67 4.7 1.77l2.83-2.83A9.95 9.95 0 0 0 12 2a10 10 0 0 0-9.2 5.5l3.62 2.8A6.03 6.03 0 0 1 12 8.4Z"/>
                </svg>
                Continue with Google
              </button>

            <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-charcoal/35">
              <span className="h-px flex-1 bg-charcoal/10" />
              Or sign in with email
              <span className="h-px flex-1 bg-charcoal/10" />
            </div>

            {multipleRestaurants && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 mb-4">
                <p className="text-xs font-semibold text-amber-900 mb-1">Multiple Restaurants Found</p>
                <p className="text-xs text-amber-800/80 mb-3">
                  This email is associated with multiple restaurants. Please choose which workspace to open:
                </p>
                <div className="space-y-2">
                  {multipleRestaurants.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleLoginWithSlug(r.slug)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-white hover:bg-amber-100/50 transition-colors text-left text-xs font-medium text-charcoal shadow-sm"
                    >
                      <div>
                        <span className="font-semibold block">{r.name}</span>
                        <span className="text-[11px] text-charcoal/50">/{r.slug}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        {r.role}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMultipleRestaurants(null)}
                  className="mt-3 text-xs text-amber-800 underline block text-center w-full cursor-pointer"
                >
                  Cancel and try another account
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {error && <ErrorBanner message={error} />}
              <div>
                <label className="mb-1 block text-xs font-medium text-charcoal/60">Email</label>
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-charcoal/60">Password</label>
                <input
                  className="input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <button className="btn-primary mt-2 w-full" type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-charcoal/10 bg-[#f7f9f6] p-4 text-center">
              <p className="text-xs text-charcoal/70">
                New restaurant owner?{" "}
                <Link to="/admin/register" className="font-semibold text-[#087f70] hover:underline">
                  Create an account →
                </Link>
              </p>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-5 space-y-2 text-center">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("demo@svaadya.com");
                      setPassword("admin123");
                      setError(null);
                    }}
                    className="text-xs text-charcoal/70 hover:text-emerald-700 hover:underline transition-colors cursor-pointer"
                  >
                    Fill Demo: <span className="font-mono text-[11px] font-semibold text-[#087f70]">demo@svaadya.com</span> / <span className="font-mono text-[11px] text-charcoal/80">admin123</span>
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@spicegarden.test");
                      setPassword("password123");
                      setError(null);
                    }}
                    className="text-[11px] text-charcoal/50 hover:text-charcoal/80 hover:underline transition-colors cursor-pointer"
                  >
                    Fill Legacy: <span className="font-mono text-[10px]">admin@spicegarden.test</span> / <span className="font-mono text-[10px]">password123</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
