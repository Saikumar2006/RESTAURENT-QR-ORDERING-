import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

export default function AdminStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "STAFF" });

  async function refresh() {
    const data = await api.get(`/restaurants/${user.restaurantId}/staff`);
    setStaff(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addStaff(e) {
    e.preventDefault();
    try {
      await api.post(`/restaurants/${user.restaurantId}/staff`, draft);
      setDraft({ name: "", email: "", password: "", role: "STAFF" });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(member) {
    await api.put(`/restaurants/${user.restaurantId}/staff/${member.id}`, { isActive: !member.isActive });
    refresh();
  }

  if (!staff) return <Spinner label="Loading staff..." />;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl mb-6">Staff</h1>
      {error && <ErrorBanner message={error} />}

      <form onSubmit={addStaff} className="card p-5 mb-6 grid grid-cols-2 gap-3">
        <input className="input" placeholder="Full name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <input className="input col-span-2" type="email" placeholder="Email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        <input className="input col-span-2" type="password" placeholder="Temporary password" required value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
        <button className="btn-primary col-span-2" type="submit">Add Staff Member</button>
      </form>

      <div className="card divide-y divide-charcoal/10">
        {staff.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="font-medium text-sm">{m.name} <span className="text-xs text-charcoal/40">· {m.role}</span></p>
              <p className="text-xs text-charcoal/50">{m.email}</p>
            </div>
            <button className={`text-xs font-semibold ${m.isActive ? "text-charcoal/50" : "text-sage"}`} onClick={() => toggleActive(m)}>
              {m.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
