import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

export default function PlatformUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== "ALL") params.role = roleFilter;
      const res = await platformApi.get("/users", { params });
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message || "Failed to load platform users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchUsers();
  }

  async function handleToggleStatus(user) {
    const nextStatus = !user.isActive;
    const actionLabel = nextStatus ? "activate" : "disable";
    if (!window.confirm(`Are you sure you want to ${actionLabel} account access for ${user.name} (${user.email})?`)) {
      return;
    }

    setUpdatingId(user.id);
    setActionSuccess(null);
    setError(null);
    try {
      await platformApi.put(`/users/${user.id}/status`, { isActive: nextStatus });
      setActionSuccess(`User ${user.email} successfully ${nextStatus ? "activated" : "disabled"}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u))
      );
    } catch (err) {
      setError(err.message || "Failed to update user status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Platform User Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Centralized cross-tenant account governance and security status across all restaurants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Refresh list"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 w-full">
          <input
            type="text"
            placeholder="Search by user name or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 whitespace-nowrap">Filter Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Restaurant Owner (ADMIN)</option>
            <option value="STAFF">Staff Member</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Loading cross-tenant users..." />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No users match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Restaurant Tenant</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                      {u.phone && <div className="text-[10px] text-slate-400">Tel: {u.phone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{u.restaurantName || "Unassigned"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.restaurantSlug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          u.role === "ADMIN"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {u.role === "ADMIN" ? "OWNER" : "STAFF"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={updatingId === u.id}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                          u.isActive
                            ? "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200"
                            : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                        } disabled:opacity-50`}
                      >
                        {updatingId === u.id ? "Updating…" : u.isActive ? "Disable" : "Activate"}
                      </button>
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
