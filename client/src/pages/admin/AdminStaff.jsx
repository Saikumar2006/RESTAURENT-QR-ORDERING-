import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

export default function AdminStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", roleId: "" });
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] });
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const canManageRoles = user?.permissions?.includes("*") || user?.permissions?.includes("staff.roles.manage");

  async function refresh() {
    const [members, roleData] = await Promise.all([
      api.get(`/restaurants/${user.restaurantId}/staff`),
      api.get(`/restaurants/${user.restaurantId}/roles`),
    ]);
    setStaff(members);
    setRoles(roleData.roles);
    setPermissionCatalog(roleData.permissions || roleData.permissionCatalog || []);
    setDraft((current) => ({ ...current, roleId: current.roleId || roleData.roles.find((role) => role.name === "STAFF")?.id || "" }));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function addStaff(e) {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...draft };
      if (!canManageRoles) delete payload.roleId;
      await api.post(`/restaurants/${user.restaurantId}/staff`, payload);
      setDraft((current) => ({ name: "", email: "", password: "", roleId: current.roleId }));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateMember(member, changes) {
    setError(null);
    try {
      await api.put(`/restaurants/${user.restaurantId}/staff/${member.id}`, changes);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRole(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/restaurants/${user.restaurantId}/roles`, newRole);
      setNewRole({ name: "", description: "", permissions: [] });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function beginRoleEdit(role) {
    setEditingRole({ id: role.id, name: role.name, description: role.description || "", permissions: [...role.permissions] });
  }

  async function saveRole(e) {
    e.preventDefault();
    if (!editingRole) return;
    setError(null);
    setSaving(true);
    try {
      if (!roles.find((role) => role.id === editingRole.id)?.isSystem) {
        await api.put(`/restaurants/${user.restaurantId}/roles/${editingRole.id}`, {
          name: editingRole.name,
          description: editingRole.description,
        });
      }
      await api.put(`/restaurants/${user.restaurantId}/roles/${editingRole.id}/permissions`, {
        permissions: editingRole.permissions,
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    setError(null);
    try {
      await api.delete(`/restaurants/${user.restaurantId}/roles/${role.id}`);
      if (editingRole?.id === role.id) setEditingRole(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const groupedPermissions = useMemo(() => permissionCatalog.reduce((groups, item) => {
    (groups[item.group] ||= []).push(item);
    return groups;
  }, {}), [permissionCatalog]);

  if (!staff) return <Spinner label="Loading team..." />;

  return (
    <div className="p-8 max-w-5xl space-y-7">
      <div>
        <h1 className="font-display text-3xl">Team & roles</h1>
        <p className="mt-1 text-sm text-charcoal/55">Create staff accounts and grant access only to the tools each person needs.</p>
      </div>
      {error && <ErrorBanner message={error} />}

      <section>
        <h2 className="font-semibold mb-3">Team members</h2>
        <div className="card divide-y divide-charcoal/10">
          {staff.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-[180px] flex-1">
                <p className="font-medium text-sm">{member.name} <span className="text-xs text-charcoal/45">· {member.roleName}</span></p>
                <p className="text-xs text-charcoal/50">{member.email}</p>
              </div>
              {!member.isOwner && canManageRoles && (
                <select className="input w-auto min-w-36" aria-label={`Role for ${member.name}`} value={member.roleId || ""} onChange={(e) => updateMember(member, { roleId: e.target.value || null })}>
                  {roles.filter((role) => role.name !== "OWNER").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              )}
              {!member.isOwner && (user.permissions?.includes("*") || user.permissions?.includes("staff.update")) && (
                <button className={`text-xs font-semibold ${member.isActive ? "text-charcoal/50" : "text-sage"}`} onClick={() => updateMember(member, { isActive: !member.isActive })}>
                  {member.isActive ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {(user.permissions?.includes("*") || user.permissions?.includes("staff.create")) && (
        <section>
          <h2 className="font-semibold mb-3">Add a team member</h2>
          <form onSubmit={addStaff} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Full name" required minLength={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {canManageRoles && <select className="input" value={draft.roleId} onChange={(e) => setDraft({ ...draft, roleId: e.target.value })} aria-label="Staff role">
              {roles.filter((role) => role.name !== "OWNER").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>}
            <input className="input sm:col-span-2" type="email" placeholder="Email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <input className="input sm:col-span-2" type="password" placeholder="Temporary password" required minLength={6} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
            <button className="btn-primary sm:col-span-2" type="submit">Add team member</button>
          </form>
        </section>
      )}

      {canManageRoles && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-semibold mb-3">Roles</h2>
            <div className="card divide-y divide-charcoal/10">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => beginRoleEdit(role)}>
                    <span className="block text-sm font-medium">{role.name}{role.isSystem ? " · built in" : ""}</span>
                    <span className="block text-xs text-charcoal/50">{role.userCount} assigned · {role.permissions.length} permissions</span>
                  </button>
                  {!role.isSystem && role.userCount === 0 && <button className="text-xs text-red-700" onClick={() => deleteRole(role)}>Delete</button>}
                </div>
              ))}
            </div>

            <form onSubmit={createRole} className="card mt-4 space-y-3 p-4">
              <h3 className="text-sm font-semibold">Create a custom role</h3>
              <input className="input" placeholder="Role name" required minLength={2} maxLength={40} value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              <input className="input" placeholder="Description (optional)" maxLength={200} value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              <PermissionPicker groups={groupedPermissions} selected={newRole.permissions} onChange={(permissions) => setNewRole({ ...newRole, permissions })} />
              <button className="btn-primary" disabled={saving}>Create role</button>
            </form>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Role permissions</h2>
            {editingRole ? (
              <form onSubmit={saveRole} className="card space-y-4 p-4">
                <input className="input" aria-label="Role name" disabled={roles.find((role) => role.id === editingRole.id)?.isSystem} value={editingRole.name} onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })} />
                <input className="input" aria-label="Role description" maxLength={200} value={editingRole.description} onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })} />
                <PermissionPicker groups={groupedPermissions} selected={editingRole.permissions} onChange={(permissions) => setEditingRole({ ...editingRole, permissions })} disabled={editingRole.name === "OWNER"} />
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={saving}>Save role</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingRole(null)}>Close</button>
                </div>
              </form>
            ) : <div className="card p-5 text-sm text-charcoal/55">Select a role to review and change its permissions.</div>}
          </div>
        </section>
      )}
    </div>
  );
}

function PermissionPicker({ groups, selected, onChange, disabled = false }) {
  function toggle(key) {
    onChange(selected.includes(key) ? selected.filter((permission) => permission !== key) : [...selected, key]);
  }

  return (
    <div className="max-h-80 space-y-3 overflow-auto rounded border border-charcoal/10 p-3">
      {Object.entries(groups).map(([group, permissions]) => (
        <fieldset key={group} className="space-y-1">
          <legend className="text-xs font-semibold uppercase tracking-wide text-charcoal/55">{group}</legend>
          {permissions.map((permission) => (
            <label key={permission.key} className="flex items-start gap-2 text-xs">
              <input type="checkbox" disabled={disabled} checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} />
              <span>{permission.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
