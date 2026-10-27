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
  const [draft, setDraft] = useState({ name: "", email: "", roleId: "" });
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] });
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [accessLinkTarget, setAccessLinkTarget] = useState(null);
  const [accessLinkReason, setAccessLinkReason] = useState("");
  const [accessLinkResult, setAccessLinkResult] = useState(null);
  const [accessLinkLoading, setAccessLinkLoading] = useState(false);
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
    setInviting(true);
    try {
      const payload = { ...draft };
      if (!canManageRoles) delete payload.roleId;
      setInviteResult(await api.post(`/restaurants/${user.restaurantId}/staff/invitations`, payload));
      setDraft((current) => ({ name: "", email: "", roleId: current.roleId }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function issueAccessLink(e) {
    e.preventDefault();
    setError(null);
    setAccessLinkLoading(true);
    setAccessLinkResult(null);
    const suffix = accessLinkTarget.purpose === "ACTIVATE" ? "invitation" : "password-reset-link";
    try {
      setAccessLinkResult(await api.post(`/restaurants/${user.restaurantId}/staff/${accessLinkTarget.member.id}/${suffix}`, { reason: accessLinkReason }));
      setAccessLinkReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAccessLinkLoading(false);
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
                {member.setupPending && <p className="mt-1 text-xs text-amber-700">Setup pending · invite expires {new Date(member.setupInviteExpiresAt).toLocaleString()}</p>}
                <details className="mt-2 text-xs">
                  <summary className="w-fit cursor-pointer font-medium text-clove underline underline-offset-2">Review access</summary>
                  <div className="mt-2 space-y-1 text-charcoal/55">
                    <p>Account: {member.isActive ? "Active" : member.setupPending ? "Setup pending" : "Inactive"}</p>
                    <p>Last sign-in: {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "No recorded sign-in"}</p>
                    <p>Permissions granted through {member.roleName}:</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">{(roles.find((role) => role.id === member.roleId)?.permissions || []).map((permission) => <span key={permission} className="rounded bg-charcoal/5 px-2 py-1 font-mono text-[10px]">{permission}</span>)}{!member.roleId && <span className="text-charcoal/45">No assigned role permissions</span>}</div>
                  </div>
                </details>
              </div>
              {!member.isOwner && canManageRoles && (
                <select className="input w-auto min-w-36" aria-label={`Role for ${member.name}`} value={member.roleId || ""} onChange={(e) => updateMember(member, { roleId: e.target.value || null })}>
                  {roles.filter((role) => role.name !== "OWNER").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              )}
              {member.setupPending && (user.permissions?.includes("*") || user.permissions?.includes("staff.create")) && <button className="text-xs font-semibold text-clove underline underline-offset-2" onClick={() => { setAccessLinkTarget({ member, purpose: "ACTIVATE" }); setAccessLinkReason(""); setAccessLinkResult(null); }}>Issue new invite</button>}
              {!member.isOwner && !member.setupPending && (user.permissions?.includes("*") || user.permissions?.includes("staff.update")) && (
                <button className={`text-xs font-semibold ${member.isActive ? "text-charcoal/50" : "text-sage"}`} onClick={() => updateMember(member, { isActive: !member.isActive })}>
                  {member.isActive ? "Deactivate" : "Activate"}
                </button>
              )}
              {!member.isOwner && member.isActive && (user.permissions?.includes("*") || user.permissions?.includes("staff.update")) && <button className="text-xs font-semibold text-charcoal/60 underline underline-offset-2" onClick={() => { setAccessLinkTarget({ member, purpose: "PASSWORD_RESET" }); setAccessLinkReason(""); setAccessLinkResult(null); }}>Password reset link</button>}
            </div>
          ))}
        </div>
      </section>

      {(user.permissions?.includes("*") || user.permissions?.includes("staff.create")) && (
        <section>
          <h2 className="font-semibold mb-3">Invite a team member</h2>
          <form onSubmit={addStaff} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">Full name<input className="input" autoComplete="name" required minLength={2} maxLength={100} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            {canManageRoles && <select className="input" value={draft.roleId} onChange={(e) => setDraft({ ...draft, roleId: e.target.value })} aria-label="Staff role">
              {roles.filter((role) => role.name !== "OWNER").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>}
            <label className="grid gap-1 text-xs sm:col-span-2">Email address<input className="input" type="email" autoComplete="email" maxLength={254} required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
            <p className="text-xs leading-5 text-charcoal/55 sm:col-span-2">The invitee sets their own password. Svaadya shows a one-time setup link here; share it with them through an approved channel.</p>
            <button className="btn-primary sm:col-span-2" type="submit" disabled={inviting}>{inviting ? "Creating invite…" : "Create secure invite"}</button>
          </form>
          {inviteResult && <section className="card mt-3 space-y-2 p-4" aria-live="polite">
            <h3 className="text-sm font-semibold">Invite created for {inviteResult.staff.email}</h3>
            <p className="text-xs text-charcoal/60">This one-time link expires {new Date(inviteResult.invite.expiresAt).toLocaleString()}. It is not emailed.</p>
            <input className="input w-full text-xs" aria-label="Staff setup link" readOnly value={inviteResult.invite.setupUrl} onFocus={(e) => e.target.select()} />
            <button className="btn-secondary text-xs" type="button" onClick={async () => { try { await navigator.clipboard.writeText(inviteResult.invite.setupUrl); } catch { /* The link remains selectable for manual copying. */ } }}>Copy setup link</button>
            <button className="ml-2 text-xs underline" type="button" onClick={() => setInviteResult(null)}>Hide link</button>
          </section>}
        </section>
      )}

      {accessLinkTarget && <section className="card space-y-3 p-5" aria-labelledby="staff-access-link-heading">
        <div><h2 id="staff-access-link-heading" className="font-semibold">{accessLinkTarget.purpose === "ACTIVATE" ? "Replace setup link" : "Create password reset link"}</h2><p className="mt-1 text-sm text-charcoal/55">For {accessLinkTarget.member.name} ({accessLinkTarget.member.email}). The previous link for this action will be invalidated.</p></div>
        {error && <ErrorBanner message={error} />}
        <form className="space-y-3" onSubmit={issueAccessLink}>
          <label className="grid gap-1 text-xs">Audit reason<textarea className="input min-h-20 py-2" required minLength={8} maxLength={500} value={accessLinkReason} onChange={(e) => setAccessLinkReason(e.target.value)} /></label>
          <div className="flex gap-2"><button className="btn-primary text-xs" disabled={accessLinkLoading}>{accessLinkLoading ? "Issuing link…" : "Issue link"}</button><button className="btn-secondary text-xs" type="button" onClick={() => { setAccessLinkTarget(null); setAccessLinkResult(null); }}>Cancel</button></div>
        </form>
        {accessLinkResult && <div className="border-t border-charcoal/10 pt-3" aria-live="polite"><p className="mb-2 text-xs text-charcoal/65">One-time link expires {new Date(accessLinkResult.invite.expiresAt).toLocaleString()}. Share it directly with the team member through an approved channel.</p><input className="input w-full text-xs" aria-label="One-time staff access link" readOnly value={accessLinkResult.invite.setupUrl} onFocus={(e) => e.target.select()} /><p className="mt-2 text-xs text-charcoal/50">The link can be selected and copied manually.</p></div>}
      </section>}

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
