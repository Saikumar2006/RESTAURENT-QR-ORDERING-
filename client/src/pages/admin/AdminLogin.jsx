import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/AuthContext.jsx";
import { ErrorBanner } from "../../components/Ui.jsx";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(state?.from?.pathname || "/admin", { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-marigold text-xs uppercase tracking-widest mb-2">Restaurant Dashboard</p>
          <h1 className="font-display text-3xl text-cream">Welcome back</h1>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-3">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="text-xs font-medium text-charcoal/60 mb-1 block">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="text-xs font-medium text-charcoal/60 mb-1 block">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="btn-primary w-full mt-2" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-xs text-charcoal/40 mt-4">
          Seeded demo login: admin@spicegarden.test / password123
        </p>
      </div>
    </div>
  );
}
