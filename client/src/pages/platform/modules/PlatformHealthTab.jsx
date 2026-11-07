import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

export default function PlatformHealthTab() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchHealth() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await platformApi.get("/system-health");
      setHealth(res);
    } catch (err) {
      setError(err.message || "Failed to load system health diagnostics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  function formatUptime(seconds = 0) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m ${s}s`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Operations & Health</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time infrastructure heartbeat, database query latency, background services, and external provider connectivity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHealth}
            disabled={refreshing}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition disabled:opacity-50"
          >
            {refreshing ? "Pinging Services…" : "Refresh Health Status"}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="py-12 flex justify-center bg-white rounded-2xl border border-slate-200/80">
          <Spinner label="Executing live infrastructure health check..." />
        </div>
      ) : health ? (
        <>
          {/* Key Infrastructure Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Database Engine</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xl font-bold text-slate-900">{health.database?.provider || "PostgreSQL"}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Latency: <span className="font-semibold text-emerald-700">{health.database?.latencyMs} ms</span> (Verified)
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Process Uptime</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatUptime(health.uptimeSeconds)}</div>
              <p className="text-[11px] text-slate-500 mt-1">Continuous zero-downtime execution</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Memory Consumption</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{health.memory?.heapUsedMb} MB Heap</div>
              <p className="text-[11px] text-slate-500 mt-1">RSS: {health.memory?.rssMb} MB allocated</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Environment</span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono uppercase">{health.environment}</div>
              <p className="text-[11px] text-slate-500 mt-1">Node API Version {health.services?.api?.version}</p>
            </div>
          </div>

          {/* Connected Services & Gateways Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Ecosystem Integration Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Twilio SMS */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Twilio SMS Gateway</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.twilioSms?.status === "READY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {health.services?.twilioSms?.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Transactional OTP & staff invitations via SMS.
                </p>
                {health.services?.twilioSms?.sender && (
                  <p className="text-[10px] text-slate-400 font-mono mt-2">Sender: {health.services.twilioSms.sender}</p>
                )}
              </div>

              {/* Twilio WhatsApp */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Twilio WhatsApp</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.twilioWhatsapp?.status === "READY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {health.services?.twilioWhatsapp?.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Customer order updates & owner alert notifications.
                </p>
                {health.services?.twilioWhatsapp?.sender && (
                  <p className="text-[10px] text-slate-400 font-mono mt-2">Sender: {health.services.twilioWhatsapp.sender}</p>
                )}
              </div>

              {/* Meta WhatsApp */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Meta WhatsApp Cloud</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.metaWhatsapp?.status === "READY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {health.services?.metaWhatsapp?.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Meta Graph API fallback for verified WhatsApp templates.
                </p>
              </div>

              {/* Payment Gateway */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Razorpay SaaS Gateway</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.paymentGateway?.keyConfigured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {health.services?.paymentGateway?.keyConfigured ? "CONFIGURED" : "MOCK DEV"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Subscription checkouts, automated billing, and webhooks.
                </p>
              </div>

              {/* Google OAuth */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Google OAuth 2.0</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.oauth?.configured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {health.services?.oauth?.configured ? "ACTIVE" : "UNCONFIGURED"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  One-click verified owner login.
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-2 truncate" title={health.services?.oauth?.callback}>
                  Callback: {health.services?.oauth?.callback}
                </p>
              </div>

              {/* Redis Distributed Limiter */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-800">Redis Distributed Cache</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    health.services?.redis?.configured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {health.services?.redis?.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Global rate limiting and distributed socket state.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
