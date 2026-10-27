import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorBanner, Spinner } from "../../components/Ui.jsx";
import api from "../../services/api";
import "../platform/platform.css";

export default function StaffAccess() {
  const { token } = useParams();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/auth/staff-access/${encodeURIComponent(token)}`)
      .then((result) => { if (active) setAccess(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/auth/staff-access/${encodeURIComponent(token)}/password`, { password });
      setComplete(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isReset = access?.purpose === "PASSWORD_RESET";
  return (
    <main className="platform-login-page">
      <Link className="platform-login-brand" to="/" aria-label="Svaadya home"><span>S</span>SVAADYA</Link>
      <div className="platform-login-layout">
        <section className="platform-login-story" aria-label="Team account access">
          <p className="platform-login-eyebrow">SVAADYA · TEAM ACCESS</p>
          <h1>{isReset ? "Choose a new password." : "Set up your team access."}</h1>
          <p>{isReset ? "Use this one-time link to replace the password on your account." : "Set a private password to activate your restaurant team account."}</p>
          <div className="platform-login-rule"><span /> RESTAURANT TEAM <span /></div>
        </section>
        <section className="platform-login-card">
          {loading ? <Spinner label="Checking your access link…" /> : complete ? <>
            <p className="platform-login-card-eyebrow">PASSWORD SAVED</p>
            <h2>{isReset ? "Your password has been updated." : `Welcome to ${access?.restaurantName}.`}</h2>
            <p className="platform-login-copy">Sign in with {access?.email} and the password you just set.</p>
            <Link className="platform-login-submit" to="/admin/login">Go to restaurant sign in <span aria-hidden="true">→</span></Link>
          </> : access ? <>
            <p className="platform-login-card-eyebrow">ONE-TIME PASSWORD LINK</p>
            <h2>{isReset ? "Reset your password" : access.restaurantName}</h2>
            <p className="platform-login-copy">For {access.email}. Expires {new Date(access.expiresAt).toLocaleString()}.</p>
            <form onSubmit={submit}>
              {error && <div role="alert" aria-live="assertive"><ErrorBanner message={error} /></div>}
              <label htmlFor="staff-new-password">{isReset ? "New password" : "Create password"}</label>
              <input id="staff-new-password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="-mt-1 text-xs text-charcoal/50">Use 10–72 characters and no more than 72 UTF-8 bytes.</p>
              <label htmlFor="staff-confirm-password">Confirm password</label>
              <input id="staff-confirm-password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
              <button className="platform-login-submit" type="submit" disabled={saving}>{saving ? "Saving password…" : isReset ? "Save new password" : "Set password and activate"}<span aria-hidden="true">→</span></button>
            </form>
          </> : <>
            <p className="platform-login-card-eyebrow">LINK UNAVAILABLE</p>
            <h2>Ask your restaurant manager for a new link.</h2>
            <p className="platform-login-copy">This one-time link may have expired, been replaced, or already been used.</p>
            {error && <div role="alert"><ErrorBanner message={error} /></div>}
            <Link className="platform-login-submit" to="/admin/login">Restaurant sign in <span aria-hidden="true">→</span></Link>
          </>}
        </section>
      </div>
      <footer className="platform-login-footer"><span>© {new Date().getFullYear()} Svaadya</span><Link to="/">Back to Svaadya</Link><span>Secure staff access</span></footer>
    </main>
  );
}
