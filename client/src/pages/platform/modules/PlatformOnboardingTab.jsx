import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

export default function PlatformOnboardingTab() {
  const [funnel, setFunnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchFunnel() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.get("/onboarding-funnel");
      setFunnel(res || []);
    } catch (err) {
      setError(err.message || "Failed to load onboarding funnel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFunnel();
  }, []);

  const total = funnel.length;
  const fullyActivated = funnel.filter((f) => f.progressPercent === 100).length;
  const inProgress = total - fullyActivated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Restaurant Onboarding Control Centre</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track restaurant progression through account setup, digital menu upload, table generation, and first order milestone.
          </p>
        </div>
        <button
          onClick={fetchFunnel}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          ↻ Refresh Pipeline
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Onboarding Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total In Pipeline</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{total}</div>
          <span className="text-[11px] text-slate-500">Registered establishments</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Onboarding In-Flight</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{inProgress}</div>
          <span className="text-[11px] text-amber-700">Incomplete setup steps</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Live & Operational</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{fullyActivated}</div>
          <span className="text-[11px] text-emerald-700">100% Onboarding verified</span>
        </div>
      </div>

      {/* Pipeline Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Analyzing restaurant onboarding progression..." />
          </div>
        ) : funnel.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No restaurant onboarding pipelines detected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-4">Owner Contact</th>
                  <th className="py-3 px-4">Completion Progress</th>
                  <th className="py-3 px-4">Setup Checklist</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {funnel.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{f.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">/r/{f.slug}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {f.ownerEmail}
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-32">
                        <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                          <span>{f.progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              f.progressPercent === 100 ? "bg-emerald-500" : "bg-teal-600"
                            }`}
                            style={{ width: `${f.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${f.steps.ownerActivated ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                          Owner ✓
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${f.steps.menuConfigured ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                          Menu ✓
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${f.steps.tablesAndQrGenerated ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                          Tables ✓
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${f.steps.firstOrderReceived ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                          1st Order ✓
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {f.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
