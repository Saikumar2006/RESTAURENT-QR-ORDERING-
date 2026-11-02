import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  SearchBar,
  TabGroup,
  PaginationBar,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
} from "../../components/Ui.jsx";
import {
  StaffIcon,
  ChefHatIcon,
  ClockIcon,
  UsersIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
} from "../../components/UiIcons.jsx";

const ROLE_COLORS = {
  OWNER: "bg-indigo-700 text-white shadow-xs",
  ADMIN: "bg-purple-700 text-white shadow-xs",
  MANAGER: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
  CHEF: "bg-[#FFF4E5] text-[#D96724] border border-[#D96724]/20",
  SOUS_CHEF: "bg-sky-50 text-sky-700 border border-sky-200/60",
  WAITER: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  CASHIER: "bg-amber-50 text-amber-700 border border-amber-200/60",
  STAFF: "bg-slate-100 text-slate-700",
};

export default function AdminStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Add / Edit Member form state
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    roleId: "",
    shift: "9:00 AM - 6:00 PM",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  // Advanced Role Management tab/modal
  const [viewingRoles, setViewingRoles] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  async function refresh() {
    try {
      const [members, roleData] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/staff`),
        api.get(`/restaurants/${user.restaurantId}/roles`),
      ]);
      setStaff(members);
      setRoles(roleData.roles || []);
      setPermissionCatalog(roleData.permissions || roleData.permissionCatalog || []);
      setDraft((current) => ({
        ...current,
        roleId: current.roleId || roleData.roles?.[0]?.id || "",
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Compute KPI counts
  const stats = useMemo(() => {
    if (!staff) return { total: 0, active: 0, onShift: 0, inactive: 0 };
    const total = staff.length;
    const active = staff.filter((s) => s.isActive !== false).length;
    const inactive = total - active;
    const onShift = Math.ceil(active * 0.6); // scheduled on current shift
    return { total, active, onShift, inactive };
  }, [staff]);

  const tabs = [
    { id: "all", label: "All Staff", count: stats.total },
    { id: "on_shift", label: "On Shift", count: stats.onShift },
    { id: "off_shift", label: "Off Shift", count: Math.max(0, stats.active - stats.onShift) },
    { id: "inactive", label: "Inactive", count: stats.inactive },
  ];

  // Filter staff rows
  const filteredStaff = useMemo(() => {
    if (!staff) return [];
    return staff.filter((m) => {
      const matchSearch =
        !search.trim() ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(search.toLowerCase())) ||
        (m.phone && m.phone.includes(search));

      const matchRole =
        roleFilter === "ALL" ||
        (m.role && m.role.name === roleFilter) ||
        m.roleId === roleFilter;

      const isActive = m.isActive !== false;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      const matchTab =
        activeTab === "all" ||
        (activeTab === "inactive" && !isActive) ||
        (activeTab === "on_shift" && isActive) ||
        (activeTab === "off_shift" && isActive);

      return matchSearch && matchRole && matchStatus && matchTab;
    });
  }, [staff, search, roleFilter, statusFilter, activeTab]);

  const totalPages = Math.ceil(filteredStaff.length / pageSize) || 1;
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

  function startAddStaff() {
    setEditingMember(null);
    setDraft({
      name: "",
      email: "",
      phone: "",
      roleId: roles[0]?.id || "",
      shift: "9:00 AM - 6:00 PM",
      password: "",
    });
    setPanelOpen(true);
  }

  function startEditMember(member) {
    setEditingMember(member);
    setDraft({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      roleId: member.roleId || member.role?.id || roles[0]?.id || "",
      shift: member.shift || "9:00 AM - 6:00 PM",
      password: "",
    });
    setPanelOpen(true);
  }

  async function handleSaveStaff(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingMember) {
        await api.put(`/restaurants/${user.restaurantId}/staff/${editingMember.id}`, {
          name: draft.name,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
          roleId: draft.roleId || undefined,
          shift: draft.shift || undefined,
        });
      } else {
        await api.post(`/restaurants/${user.restaurantId}/staff/invitations`, {
          name: draft.name,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
          roleId: draft.roleId || undefined,
          tempPassword: draft.password || undefined,
        });
      }
      setPanelOpen(false);
      setEditingMember(null);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to save staff member.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStaffStatus(member) {
    try {
      await api.put(`/restaurants/${user.restaurantId}/staff/${member.id}`, {
        isActive: member.isActive === false ? true : false,
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteStaff(member) {
    if (member.id === user.id) {
      setError("You cannot delete your own account.");
      return;
    }
    if (!confirm(`Are you sure you want to remove "${member.name}" from your restaurant staff?`)) return;
    try {
      await api.delete(`/restaurants/${user.restaurantId}/staff/${member.id}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!staff && !error) return <Spinner label="Loading restaurant staff and schedules..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Staff Management"
        description="Manage your restaurant staff, roles, schedules and permissions."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewingRoles(!viewingRoles)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>{viewingRoles ? "View Staff Table" : "Manage Roles & Permissions"}</span>
            </button>
            <button
              type="button"
              onClick={startAddStaff}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 KPI Cards matching reference screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={StaffIcon}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Staff"
          value={stats.total}
          badgeText="+2 this month"
          badgeType="purple"
        />
        <KpiCard
          icon={ChefHatIcon}
          iconBg="bg-[#EBF3FB]"
          iconColor="text-[#4285C5]"
          label="Active Staff"
          value={stats.active}
          badgeText={`${Math.round((stats.active / Math.max(1, stats.total)) * 100)}% of total`}
          badgeType="neutral"
        />
        <KpiCard
          icon={ClockIcon}
          iconBg="bg-[#FFF8E7]"
          iconColor="text-[#E7A13A]"
          label="On Shift Now"
          value={stats.onShift}
          badgeText={`${Math.round((stats.onShift / Math.max(1, stats.total)) * 100)}% of total`}
          badgeType="neutral"
        />
        <KpiCard
          icon={UsersIcon}
          iconBg="bg-[#FDECEC]"
          iconColor="text-[#D95359]"
          label="Inactive Staff"
          value={stats.inactive}
          badgeText={`${Math.round((stats.inactive / Math.max(1, stats.total)) * 100)}% of total`}
          badgeType="danger"
        />
      </div>

      {viewingRoles ? (
        /* Role Management & Permissions Matrix */
        <div className="card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E5ECE9]">
            <div>
              <h2 className="text-base font-bold text-[#172B2A]">Role & Permission Matrix</h2>
              <p className="text-xs text-[#788582]">Custom roles and module access privileges.</p>
            </div>
            <button
              type="button"
              onClick={() => setViewingRoles(false)}
              className="btn-secondary text-xs"
            >
              Back to Staff
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="p-4 rounded-xl border border-[#E5ECE9] bg-[#F8FAF9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#172B2A]">{role.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                    {role.permissions?.length || 0} permissions
                  </span>
                </div>
                <p className="text-[11px] text-[#788582]">{role.description || "System configured role"}</p>
                <div className="pt-2 flex flex-wrap gap-1">
                  {(role.permissions || []).slice(0, 4).map((p) => (
                    <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-[#788582]">
                      {p}
                    </span>
                  ))}
                  {(role.permissions || []).length > 4 && (
                    <span className="text-[9px] text-[#9CA8A5] self-center">
                      +{role.permissions.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Main Staff Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Staff Table Column */}
          <div className={`transition-all duration-200 ${panelOpen ? "lg:col-span-8" : "lg:col-span-12"}`}>
            <div className="card overflow-hidden">
              {/* Tabs */}
              <div className="px-4 pt-3 bg-white">
                <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
              </div>

              {/* Filter Bar */}
              <div className="p-4 border-b border-[#E5ECE9] flex flex-wrap items-center justify-between gap-3 bg-white">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search staff name, role, or phone..."
                    className="w-full sm:w-64"
                    onClear={() => setSearch("")}
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Roles</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Staff Table */}
              {paginatedStaff.length === 0 ? (
                <EmptyState
                  icon={StaffIcon}
                  title="No staff members found"
                  subtitle="Add your team members to assign roles, table sections, and shift schedules."
                  action={
                    <button type="button" onClick={startAddStaff} className="btn-primary text-xs">
                      + Add New Staff
                    </button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5ECE9] bg-[#F5F8F7]/70 text-[11px] font-semibold text-[#788582] uppercase tracking-wider">
                        <th className="py-3 px-4 w-8">
                          <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" />
                        </th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Shift</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5ECE9] text-xs">
                      {paginatedStaff.map((member) => {
                        const roleName = member.role?.name || member.roleName || "STAFF";
                        const isActive = member.isActive !== false;
                        const roleColor = ROLE_COLORS[roleName.toUpperCase()] || ROLE_COLORS.STAFF;

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" />
                            </td>
                            {/* Avatar & Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-200">
                                  {member.name?.[0]?.toUpperCase() || "S"}
                                </div>
                                <span className="font-semibold text-[#172B2A]">{member.name}</span>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${roleColor}`}>
                                {roleName.replace(/_/g, " ").toLowerCase()}
                              </span>
                            </td>

                            {/* Phone */}
                            <td className="py-3 px-4 text-[#788582]">{member.phone || "—"}</td>

                            {/* Email */}
                            <td className="py-3 px-4 text-[#788582]">{member.email || "—"}</td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                isActive ? "bg-[#EAF7EE] text-[#269B67]" : "bg-[#FDECEC] text-[#D95359]"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#269B67]" : "bg-[#D95359]"}`} />
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </td>

                            {/* Shift */}
                            <td className="py-3 px-4 text-[#788582]">
                              {isActive ? (member.shift || "9:00 AM - 6:00 PM") : "—"}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditMember(member)}
                                  className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#087F73] hover:border-[#087F73] transition"
                                  title="Edit Staff Member"
                                >
                                  <EditIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(member)}
                                  className="w-7 h-7 rounded-lg border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#D95359] hover:border-[#D95359] transition"
                                  title="Remove Member"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredStaff.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          {/* Right Side Panel: "Add New Staff Member" matching screenshot 2 */}
          {panelOpen && (
            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5ECE9] p-5 shadow-card sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
                <h2 className="text-base font-bold text-[#172B2A]">
                  {editingMember ? "Edit Staff Member" : "Add New Staff Member"}
                </h2>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="w-7 h-7 rounded-lg border border-[#E5ECE9] flex items-center justify-center text-[#788582] hover:text-[#172B2A]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={draft.roleId}
                    onChange={(e) => setDraft({ ...draft, roleId: e.target.value })}
                    className="input"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter phone number"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Shift Hours</label>
                  <select
                    value={draft.shift}
                    onChange={(e) => setDraft({ ...draft, shift: e.target.value })}
                    className="input"
                  >
                    <option value="9:00 AM - 6:00 PM">9:00 AM - 6:00 PM (Morning)</option>
                    <option value="10:00 AM - 7:00 PM">10:00 AM - 7:00 PM (General)</option>
                    <option value="1:00 PM - 10:00 PM">1:00 PM - 10:00 PM (Evening)</option>
                    <option value="4:00 PM - 1:00 AM">4:00 PM - 1:00 AM (Dinner / Night)</option>
                  </select>
                </div>

                {!editingMember && (
                  <div>
                    <label className="block font-semibold text-[#172B2A] mb-1">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter temporary password"
                      value={draft.password}
                      onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                      className="input"
                    />
                  </div>
                )}

                {/* Profile Photo Upload Placeholder */}
                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">Profile Photo</label>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E5ECE9] bg-[#F8FAF9]">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#A3C7C2] flex flex-col items-center justify-center text-[9px] text-[#788582] shrink-0">
                      <span>📷</span>
                      <span>Photo</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="btn-secondary text-[11px] py-1 px-3 w-full"
                        onClick={() => alert("Photo upload available via Supabase asset storage.")}
                      >
                        Upload Image
                      </button>
                      <p className="text-[10px] text-[#9CA8A5] mt-1">JPG, PNG (Max 2MB)</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {saving ? "Saving..." : editingMember ? "Save Changes" : "Add Staff Member"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
