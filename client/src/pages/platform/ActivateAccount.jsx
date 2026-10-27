import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorBanner, Spinner } from "../../components/Ui.jsx";
import platformApi from "../../services/platformApi";
import "./platform.css";

export default function ActivateAccount() {
  const { token } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    let active = true;
    platformApi.get(`/invitations/${encodeURIComponent(token)}`)
      .then((result) => { if (active) setInvitation(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await platformApi.post(`/invitations/${encodeURIComponent(token)}/activate`, { password });
      setActivated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="platform-login-page">
      <Link className="platform-login-brand" to="/" aria-label="Svaadya home"><span>S</span>SVAADYA</Link>
      <div className="platform-login-layout">
        <section className="platform-login-story" aria-label="Restaurant owner account setup">
          <p className="platform-login-eyebrow">SVAADYA · RESTAURANT ACCESS</p>
          <h1>Make this restaurant yours.</h1>
          <p>Set a private password to activate your restaurant owner account.</p>
          <div className="platform-login-rule"><span /> OWNER ACCOUNT SETUP <span /></div>
        </section>
        <section className="platform-login-card">
          {loading ? <Spinner label="Checking your setup link…" /> : activated ? <>
            <p className="platform-login-card-eyebrow">ACCOUNT ACTIVE</p>
            <h2>Welcome to {invitation?.restaurantName}.</h2>
            <p className="platform-login-copy">Your owner account is ready. Sign in with {invitation?.ownerEmail} and the password you just created. Your restaurant stays closed until you finish setup and open it.</p>
            <Link className="platform-login-submit" to="/admin/login">Go to restaurant sign in <span aria-hidden="true">→</span></Link>
          </> : invitation ? <>
            <p className="platform-login-card-eyebrow">ONE-TIME SETUP</p>
            <h2>{invitation.restaurantName}</h2>
            <p className="platform-login-copy">Account for {invitation.ownerEmail}. This link expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
            <form onSubmit={submit}>
              {error && <div role="alert" aria-live="assertive"><ErrorBanner message={error} /></div>}
              <label htmlFor="owner-new-password">Create password</label>
              <input id="owner-new-password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="-mt-1 text-xs text-charcoal/50">Use 10–72 characters. Passwords are limited to 72 UTF-8 bytes.</p>
              <label htmlFor="owner-confirm-password">Confirm password</label>
              <input id="owner-confirm-password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <button className="platform-login-submit" type="submit" disabled={submitting}>{submitting ? "Activating account…" : "Set password and activate"}<span aria-hidden="true">→</span></button>
            </form>
          </> : <>
            <p className="platform-login-card-eyebrow">SETUP LINK UNAVAILABLE</p>
            <h2>Ask the Svaadya team for a new invite.</h2>
            <p className="platform-login-copy">This one-time link may have expired or already been used.</p>
            {error && <div role="alert"><ErrorBanner message={error} /></div>}
            <Link className="platform-login-submit" to="/admin/login">Restaurant sign in <span aria-hidden="true">→</span></Link>
          </>}
        </section>
      </div>
      <footer className="platform-login-footer"><span>© {new Date().getFullYear()} Svaadya</span><Link to="/">Back to Svaadya</Link><span>One-time owner activation</span></footer>
    </main>
  );
}
