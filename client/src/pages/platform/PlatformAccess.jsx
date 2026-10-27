import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import platformApi from "../../services/platformApi";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { ErrorBanner, Spinner } from "../../components/Ui.jsx";

const ROLES = ["SUPER_ADMIN", "PLATFORM_OPERATIONS", "FINANCE_ADMIN", "SUPPORT_AGENT", "READ_ONLY_AUDITOR"];

export default function PlatformAccess() {
  const { admin } = usePlatformAuth();
  const [admins, setAdmins] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  async function refresh() {
    const result = await platformApi.get("/admins");
    setAdmins(result);
    setDrafts(Object.fromEntries(result.map((entry) => [entry.id, entry.platformRole])));
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function saveRole(entry) {
    setError(null);
    setSaved(null);
    try {
      const updated = await platformApi.put(`/admins/${entry.id}/role`, { platformRole: drafts[entry.id] });
      setAdmins((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSaved(entry.id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!admin?.permissions?.includes("platform.admins.manage")) {
    return <main className="min-h-screen p-8"><ErrorBanner message="You do not have permission to manage platform access." /><Link className="btn-secondary mt-4 inline-block" to="/platform/dashboard">Back to overview</Link></main>;
  }
  if (!admins && !error) return <Spinner label="Loading platform access..." />;

  return (
    <main className="min-h-screen bg-cream/40 p-5 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="section-eyebrow !ml-0">Platform security</p><h1 className="font-display text-3xl">Platform access</h1><p className="mt-2 text-sm text-charcoal/55">Assign separate platform roles. Restaurant roles cannot grant these permissions.</p></div>
          <Link className="btn-secondary" to="/platform/dashboard">Back to overview</Link>
        </header>
        {error && <ErrorBanner message={error} />}
        <section className="card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(170px,240px)_auto] gap-3 border-b border-charcoal/10 bg-charcoal/[0.025] px-4 py-3 text-xs font-semibold text-charcoal/55"><span>Administrator</span><span>Platform role</span><span>Action</span></div>
          {admins?.map((entry) => (
            <div key={entry.id} className="grid grid-cols-1 items-center gap-3 border-b border-charcoal/5 px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(170px,240px)_auto]">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{entry.name}{entry.id === admin.id ? " · You" : ""}</p><p className="truncate text-xs text-charcoal/50">{entry.email}{!entry.isActive && " · inactive"}</p></div>
              <label><span className="sr-only">Role for {entry.email}</span><select className="input py-2 text-xs" value={drafts[entry.id] || "READ_ONLY_AUDITOR"} onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}>{ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>
              <div className="flex items-center gap-2"><button className="btn-primary px-3 py-2 text-xs" disabled={drafts[entry.id] === entry.platformRole} onClick={() => saveRole(entry)}>Save role</button>{saved === entry.id && <span className="text-xs text-emerald-700" role="status">Saved</span>}</div>
            </div>
          ))}
          {!admins?.length && <p className="p-6 text-sm text-charcoal/50">No platform administrators found.</p>}
        </section>
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">The environment allowlist <code>PLATFORM_SUPER_ADMIN_EMAILS</code> grants Super Admin access regardless of the stored role. Remove an email from the allowlist only after assigning another active Super Admin.</section>
      </div>
    </main>
  );
}
