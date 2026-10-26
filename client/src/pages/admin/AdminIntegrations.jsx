import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { ErrorBanner, Spinner } from "../../components/Ui.jsx";

const PROVIDERS = [
  { key: "SWIGGY", name: "Swiggy", description: "Marketplace orders can enter the Svaadya inbox only through an approved merchant/POS partner integration." },
  { key: "ZOMATO", name: "Zomato", description: "POS access requires partner acceptance and the outlet's authorized integration setup." },
];

export default function AdminIntegrations() {
  const { user } = useAuth();
  const [providers, setProviders] = useState(null);
  const [fixtures, setFixtures] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}/integrations/status`)
      .then(setProviders)
      .catch((err) => setError(err.message));
  }, [user.restaurantId]);

  async function loadFixture(provider) {
    setError(null);
    try {
      const fixture = await api.get(`/restaurants/${user.restaurantId}/integrations/${provider}/test-fixture`);
      setFixtures((current) => ({ ...current, [provider]: fixture }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!providers && !error) return <Spinner label="Checking order channels..." />;
  if (!providers) return <div className="p-6"><ErrorBanner message={error} /><button className="btn-secondary mt-3" onClick={() => api.get(`/restaurants/${user.restaurantId}/integrations/status`).then(setProviders).catch((err) => setError(err.message))}>Retry</button></div>;

  const statusByProvider = Object.fromEntries(providers.map((item) => [item.provider, item]));
  return (
    <div className="space-y-6 p-4 md:p-7">
      <div><p className="section-eyebrow !ml-0">Order channels</p><h2 className="font-display text-3xl">Marketplace integrations</h2><p className="mt-2 max-w-2xl text-sm text-charcoal/55">Review connection status and partner onboarding. Live Swiggy and Zomato ingestion is disabled until authorized partner access, provider documentation, and verified credentials are available.</p></div>
      {error && <ErrorBanner message={error} />}
      <div className="grid gap-4 xl:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const status = statusByProvider[provider.key];
          return <section className="card p-5 md:p-6" key={provider.key}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-2xl">{provider.name}</h3><p className="mt-2 text-sm text-charcoal/55">{provider.description}</p></div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">{status?.status === "NOT_CONFIGURED" ? "Not connected" : status?.status || "Status unavailable"}</span></div>
            <div className="mt-5 rounded-lg bg-[#f7f8f5] p-4"><h4 className="text-sm font-semibold">Onboarding checklist</h4><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-charcoal/60"><li>Obtain written authorization for this POS product and restaurant outlet.</li><li>Confirm the documented order and webhook contract, event IDs, signatures, and status transitions.</li><li>Configure credentials through an approved server-side secret process; never provide marketplace passwords.</li><li>Verify duplicate delivery, retries, delayed events, and settlement mapping in the provider sandbox before enabling live sync.</li></ol></div>
            {import.meta.env.DEV && <div className="mt-4"><button className="btn-secondary px-3 py-2 text-xs" onClick={() => loadFixture(provider.key)}>Preview test fixture</button>{fixtures[provider.key] && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-900">Test fixture · read-only · not a real marketplace order</p><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] text-blue-950">{JSON.stringify(fixtures[provider.key], null, 2)}</pre></div>}</div>}
          </section>;
        })}
      </div>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5"><div><h3 className="font-semibold">Manual fallback is available</h3><p className="mt-1 text-sm text-charcoal/55">Staff can enter a marketplace phone order manually. It is labelled Manual and does not claim to be synchronized to Swiggy or Zomato.</p></div><Link className="btn-primary" to="/admin/orders">Open order inbox</Link></section>
      <p className="text-xs text-charcoal/45">Current status: {PROVIDERS.map((provider) => `${provider.name} ${statusByProvider[provider.key]?.status || "unknown"}`).join(" · ")}. No provider credentials or approvals are present in this environment.</p>
    </div>
  );
}
