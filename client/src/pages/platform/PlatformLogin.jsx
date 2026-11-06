import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { ErrorBanner } from "../../components/Ui.jsx";
import { LanguageSwitcher, useTranslation } from "../../i18n.jsx";
import "./platform.css";

export default function PlatformLogin() {
  const { t } = useTranslation();
  const { admin, login } = usePlatformAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (admin) {
      navigate("/super-admin/dashboard", { replace: true });
    }
  }, [admin, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.accountType === "platform") {
        navigate(result.redirectTo || "/super-admin/dashboard", { replace: true });
        return;
      }
      // If a non-platform account was supplied
      setError("This account is not a provisioned platform administrator. Use the restaurant portal instead.");
      setSubmitting(false);
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setSubmitting(false);
    }
  }

  return (
    <main className="platform-login-page">
      <div className="language-switcher-dock z-20 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm"><LanguageSwitcher /></div>
      <Link className="platform-login-brand" to="/" aria-label="Svaadya home">
        <span>S</span>SVAADYA
      </Link>
      <div className="platform-login-layout">
        <section className="platform-login-story" aria-label="Platform administration">
          <p className="platform-login-eyebrow">SVAADYA · SUPER ADMIN</p>
          <h1>{t("platformLogin")}</h1>
          <p>Centralized governance, tenant monitoring, and financial operations across the entire restaurant network.</p>
          <div className="platform-login-rule">
            <span /> RESTRICTED PLATFORM ACCESS <span />
          </div>
          <div className="platform-login-highlights">
            <div className="platform-login-highlight-item">
              <strong>Multi-Tenant Isolation</strong>
              <span>Zero cross-tenant exposure with dedicated platform credentials.</span>
            </div>
            <div className="platform-login-highlight-item">
              <strong>Audit & Compliance</strong>
              <span>Every administrative operation is cryptographically signed and logged.</span>
            </div>
          </div>
        </section>

        <section className="platform-login-card">
          <p className="platform-login-card-eyebrow">ENTERPRISE ACCESS</p>
          <h2>Super Admin Sign In</h2>
          <p className="platform-login-copy">Authenticate using your provisioned platform credentials.</p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div role="alert" aria-live="assertive" className="mb-4">
                <ErrorBanner message={error} />
              </div>
            )}

            <label htmlFor="platform-email">{t("emailAddress")}</label>
            <input
              id="platform-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              placeholder="svaadyarestro@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="platform-password">{t("password")}</label>
            <div className="platform-password-wrap">
              <input
                id="platform-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="platform-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button className="platform-login-submit" type="submit" disabled={submitting}>
              {submitting ? t("signingIn") : t("signIn")}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="platform-login-footnote">
            Looking for your restaurant dashboard?{" "}
            <Link to="/admin/login">Restaurant Owner Portal</Link>
          </p>
        </section>
      </div>
      <footer className="platform-login-footer">
        <span>© {new Date().getFullYear()} Svaadya SaaS Platform</span>
        <a href="mailto:svaadyarestro@gmail.com" className="hover:underline">Help: svaadyarestro@gmail.com</a>
        <Link to="/">Public Site</Link>
        <span>Secure 256-bit TLS Session</span>
      </footer>
    </main>
  );
}
