import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { ErrorBanner } from "../../components/Ui.jsx";

function previewSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", cuisineType: "", adminName: "", adminEmail: "", adminPassword: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null); // { slug } once registration succeeds

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const restaurant = await api.post("/restaurants", form);
      setCreated(restaurant);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (created) {
    const url = `${window.location.origin}/r/${created.slug}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal px-6 py-10">
        <div className="w-full max-w-md">
          <div className="card p-6 text-center space-y-3">
            <p className="text-3xl">🎉</p>
            <h1 className="font-display text-2xl">You're all set</h1>
            <p className="text-sm text-charcoal/60">
              Your ordering page was created automatically at:
            </p>
            <p className="input font-mono text-sm break-all select-all">{url}</p>
            <p className="text-xs text-charcoal/50">
              You'll find this same link, plus a downloadable QR code, in Admin &gt; Tables after you sign in.
            </p>
            <button className="btn-primary w-full mt-2" onClick={() => navigate("/admin/login")}>
              Continue to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-marigold text-xs uppercase tracking-widest mb-2">Get Started</p>
          <h1 className="font-display text-3xl text-cream">Set up your restaurant</h1>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-3">
          {error && <ErrorBanner message={error} />}
          <input className="input" placeholder="Restaurant name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          {form.name && (
            <p className="text-xs text-charcoal/50 -mt-1 px-1">
              Your ordering page will be created at: <span className="font-mono">/r/{previewSlug(form.name) || "..."}</span>
            </p>
          )}
          <input className="input" placeholder="Cuisine / type (e.g. North Indian, Cafe) — optional" value={form.cuisineType} onChange={(e) => set("cuisineType", e.target.value)} />
          <hr className="border-charcoal/10" />
          <input className="input" placeholder="Your name" required value={form.adminName} onChange={(e) => set("adminName", e.target.value)} />
          <input className="input" type="email" placeholder="Your email" required value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
          <input className="input" type="password" placeholder="Choose a password" required value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
          <button className="btn-primary w-full mt-2" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Restaurant"}
          </button>
        </form>
        <p className="text-center text-xs text-cream/40 mt-4">
          Already have an account? <a href="/admin/login" className="underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
