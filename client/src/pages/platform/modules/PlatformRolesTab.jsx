import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

const PLATFORM_ROLES = [
  {
    role: "SUPER_ADMIN",
    label: "Super Platform Admin",
    description: "Complete unrestricted governance over the SaaS platform, all restaurants, billing, and identity.",
    permissions: [
      "platform.dashboard.view",
      "platform.restaurants.view",
      "platform.restaurants.manage",
      "platform.finance.view",
      "platform.support.manage",
      "platform.admins.manage",
      "platform.audit.view",
    ],
  },
  {
    role: "PLATFORM_OPERATIONS",
    label: "Platform Operations Manager",
    description: "Oversees day-to-day restaurant lifecycle, tenant onboarding, support triage, and audits.",
    permissions: [
      "platform.dashboard.view",
      "platform.restaurants.view",
      "platform.restaurants.manage",
      "platform.support.manage",
      "platform.audit.view",
    ],
  },
  {
    role: "FINANCE_ADMIN",
    label: "Finance Administrator",
    description: "Monitors payment transactions, SaaS subscriptions, revenue reconciliations, and financial audits.",
    permissions: [
      "platform.dashboard.view",
      "platform.finance.view",
      "platform.audit.view",
    ],
  },
  {
    role: "SUPPORT_AGENT",
    label: "Support Administrator",
    description: "Triage customer and restaurant issues, assist with onboarding, and update support tickets.",
    permissions: [
      "platform.dashboard.view",
      "platform.restaurants.view",
      "platform.support.manage",
    ],
  },
  {
    role: "READ_ONLY_AUDITOR",
    label: "Compliance & Security Auditor",
    description: "Read-only visibility for security reviews, compliance verification, and immutable audit inspection.",
    permissions: [
      "platform.dashboard.view",
      "platform.restaurants.view",
      "platform.finance.view",
      "platform.audit.view",
    ],
  },
];

const TENANT_ROLES = [
  {
    role: "ADMIN",
    label: "Restaurant Owner",
    scope: "Restaurant-wide",
    description: "Full control over a single restaurant tenant: menu, tables, billing, staff, and analytics.",
    permissions: ["orders.view", "orders.edit", "menu.view", "menu.edit", "tables.view", "tables.edit", "staff.view", "staff.edit", "inventory.view", "inventory.edit", "coupons.view", "coupons.edit", "analytics.view", "settings.view", "settings.edit"],
  },
  {
    role: "STAFF",
    label: "Restaurant Staff Member",
    scope: "Restaurant-wide (Operational)",
    description: "Operational access for order preparation, table management, and real-time kitchen status.",
    permissions: ["orders.view", "orders.edit", "tables.view"],
  },
];

export default function PlatformRolesTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("platform");
  const [draftRoles, setDraftRoles] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  async function fetchAdmins() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.get("/admins");
      setAdmins(res || []);
      setDraftRoles(Object.fromEntries((res || []).map((a) => [a.id, a.platformRole])));
    } catch (err) {
      setError(err.message || "Failed to load platform admins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function handleSaveRole(adminId) {
    setSavingId(adminId);
    setError(null);
    setSaveSuccess(null);
    try {
      const updated = await platformApi.put(`/admins/${adminId}/role`, {
        platformRole: draftRoles[adminId],
      });
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? updated : a)));
      setSaveSuccess(`Role updated to ${updated.platformRole} for ${updated.email}`);
    } catch (err) {
      setError(err.message || "Failed to update admin role.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Roles & Permissions Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise RBAC governance: separate platform-level authority from tenant-level restaurant permissions with deny-by-default rules.
          </p>
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab("platform")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "platform" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Platform Roles
          </button>
          <button
            onClick={() => setActiveTab("tenant")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "tenant" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tenant Roles
          </button>
          <button
            onClick={() => setActiveTab("assign")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "assign" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Admins Directory
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="font-bold">×</button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Tab 1: Platform Roles */}
      {activeTab === "platform" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORM_ROLES.map((r) => (
            <div key={r.role} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{r.label}</h3>
                  <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {r.role}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  Platform-wide
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{r.description}</p>
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5">Granted Capabilities</span>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Tenant Roles */}
      {activeTab === "tenant" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TENANT_ROLES.map((r) => (
            <div key={r.role} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{r.label}</h3>
                  <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {r.role}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  {r.scope}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{r.description}</p>
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5">Tenant Permissions</span>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Administrators Assignment */}
      {activeTab === "assign" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Spinner label="Loading platform administrators..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{a.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{a.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={draftRoles[a.id] || a.platformRole}
                          onChange={(e) => setDraftRoles({ ...draftRoles, [a.id]: e.target.value })}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          {PLATFORM_ROLES.map((r) => (
                            <option key={r.role} value={r.role}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {a.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSaveRole(a.id)}
                          disabled={savingId === a.id || draftRoles[a.id] === a.platformRole}
                          className="px-3 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-40 transition"
                        >
                          {savingId === a.id ? "Saving…" : "Save Role"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
