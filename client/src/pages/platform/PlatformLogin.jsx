import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { useAuth } from "../../store/AuthContext.jsx";
import { ErrorBanner } from "../../components/Ui.jsx";
import "./platform.css";

export default function PlatformLogin() {
  const { admin, login } = usePlatformAuth();
  const { user, setSessionFromLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (admin) {
      navigate("/super-admin/dashboard", { replace: true });
    } else if (user) {
      const destination = user.role === "STAFF" ? "/admin/orders" : "/admin";
      navigate(destination, { replace: true });
    }
  }, [admin, user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.accountType === "tenant" && result.token) {
        setSessionFromLogin(result.token, result.user);
        const destination = result.user?.role === "STAFF" ? "/admin/orders" : (result.redirectTo || "/admin");
        navigate(destination, { replace: true });
        return;
      }
      navigate(result.redirectTo || "/super-admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setSubmitting(false);
    }
  }

  return (
    <main className="platform-login-page">
      <Link className="platform-login-brand" to="/" aria-label="Svaadya home"><span>S</span>SVAADYA</Link>
      <div className="platform-login-layout">
        <section className="platform-login-story" aria-label="Platform administration">
          <p className="platform-login-eyebrow">SVAADYA · PLATFORM ACCESS</p>
          <h1>One thoughtful view of every restaurant.</h1>
          <p>Secure access for the people responsible for the Svaadya platform.</p>
          <div className="platform-login-rule"><span /> PLATFORM ADMINISTRATION <span /></div>
        </section>
        <section className="platform-login-card">
          <p className="platform-login-card-eyebrow">RESTRICTED ACCESS</p>
          <h2>Platform Administration</h2>
          <p className="platform-login-copy">Sign in with your provisioned platform administrator account.</p>
          <form onSubmit={handleSubmit}>
            {error && <div role="alert" aria-live="assertive"><ErrorBanner message={error} /></div>}
            <label htmlFor="platform-email">Email address</label>
            <input id="platform-email" name="email" type="email" required maxLength={254} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="platform-password">Password</label>
            <div className="platform-password-wrap">
              <input id="platform-password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="platform-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <button className="platform-login-submit" type="submit" disabled={submitting}>{submitting ? "Verifying access…" : "Sign in securely"}<span aria-hidden="true">→</span></button>
          </form>
          <p className="platform-login-footnote">Platform access is managed separately from restaurant accounts. <Link to="/admin/login">Restaurant login</Link></p>
        </section>
      </div>
      <footer className="platform-login-footer"><span>© {new Date().getFullYear()} Svaadya</span><Link to="/">Back to Svaadya</Link><span>Secure platform session</span></footer>
    </main>
  );
}
