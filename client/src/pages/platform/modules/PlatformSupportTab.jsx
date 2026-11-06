import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

export default function PlatformSupportTab({ restaurants }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // New ticket modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("GENERAL");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newRestaurantId, setNewRestaurantId] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected ticket drawer / edit
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchTickets() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.get("/tickets", {
        params: { status: statusFilter, priority: priorityFilter },
      });
      setTickets(res.tickets || []);
    } catch (err) {
      setError(err.message || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  async function handleCreateTicket(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await platformApi.post("/tickets", {
        title: newTitle,
        description: newDesc,
        category: newCategory,
        priority: newPriority,
        restaurantId: newRestaurantId || undefined,
        contactEmail: newContactEmail || undefined,
        internalNotes: newNotes,
      });
      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewNotes("");
      setNewContactEmail("");
      fetchTickets();
    } catch (err) {
      setError(err.message || "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateTicket(ticketId) {
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await platformApi.put(`/tickets/${ticketId}`, {
        status: editStatus,
        internalNotes: editNotes,
      });
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      setSelectedTicket(updated);
    } catch (err) {
      setError(err.message || "Failed to update ticket.");
    } finally {
      setSavingEdit(false);
    }
  }

  function openDetailDrawer(ticket) {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditNotes(ticket.internalNotes || "");
  }

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Support & Platform Operations</h2>
          <p className="text-xs text-slate-500 mt-1">
            Resolve restaurant incidents, review support requests, and record internal troubleshooting notes.
          </p>
          <p className="text-xs text-teal-800 font-medium mt-1.5 flex items-center gap-1.5">
            <span>Official Support Inbox:</span>
            <a href="mailto:svaadyarestro@gmail.com" className="underline font-mono font-semibold">svaadyarestro@gmail.com</a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition"
          >
            + Create Ticket
          </button>
          <button
            onClick={fetchTickets}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Ticket Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Open Tickets</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{openCount}</div>
          <span className="text-[10px] text-slate-400">Needs immediate review</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">In Progress</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{inProgressCount}</div>
          <span className="text-[10px] text-slate-400">Under operational investigation</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Resolved / Closed</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{resolvedCount}</div>
          <span className="text-[10px] text-slate-400">Successfully closed</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-slate-400">{tickets.length} total tickets displayed</div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Loading support tickets..." />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No support tickets found. Click "+ Create Ticket" to log a new issue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-600">#{t.ticketNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.title}</td>
                    <td className="py-3 px-4 text-slate-700">{t.restaurant?.name || "Platform-Wide"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.priority === "URGENT"
                            ? "bg-rose-100 text-rose-800"
                            : t.priority === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          t.status === "OPEN"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : t.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDetailDrawer(t)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details & Resolution Drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-[11px] font-mono text-slate-400">Ticket #{selectedTicket.ticketNumber}</span>
                  <h3 className="text-lg font-bold text-slate-900">{selectedTicket.title}</h3>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Description</span>
                  <p className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200/80 leading-relaxed">
                    {selectedTicket.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Restaurant</span>
                    <p className="font-semibold text-slate-800">{selectedTicket.restaurant?.name || "Platform-wide"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Category</span>
                    <p className="font-semibold text-slate-800">{selectedTicket.category}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <label className="block text-slate-700 font-semibold mb-1">Status Transition</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Internal Troubleshooting Notes</label>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add steps taken, root cause, or resolution details..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-sans"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTicket(selectedTicket.id)}
                disabled={savingEdit}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition disabled:opacity-50"
              >
                {savingEdit ? "Saving Changes…" : "Update Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Create Support Incident</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject / Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Printer webhook sync delay"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Restaurant Tenant</label>
                <select
                  value={newRestaurantId}
                  onChange={(e) => setNewRestaurantId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Platform-Wide / General</option>
                  {(restaurants || []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="GENERAL">General</option>
                    <option value="BILLING">Billing</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="ONBOARDING">Onboarding</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the incident details, affected tables or orders..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
                <input
                  type="text"
                  placeholder="Initial triage thoughts..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
