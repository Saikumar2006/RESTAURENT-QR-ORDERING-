import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import { StatusBadge, Spinner, ErrorBanner } from "../../components/Ui.jsx";

const NEXT_STATUS = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
};

export default function AdminOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("orderId"));
  const [error, setError] = useState(null);

  async function refresh() {
    const data = await api.get(`/restaurants/${user.restaurantId}/orders`, {
      params: { pageSize: 50, ...(statusFilter ? { status: statusFilter } : {}) },
    });
    setOrders(data);
  }

  useEffect(() => {
    refresh();
    const socket = getSocket();
    socket.on("order:new", refresh);
    socket.on("order:updated", refresh);
    return () => {
      socket.off("order:new", refresh);
      socket.off("order:updated", refresh);
    };
  }, [statusFilter]);

  const selected = orders?.find((o) => o.id === selectedId);

  async function changeStatus(orderId, status) {
    setError(null);
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex h-screen">
      <div className="w-[420px] shrink-0 border-r border-charcoal/10 flex flex-col">
        <div className="p-5 border-b border-charcoal/10">
          <h1 className="font-display text-2xl mb-3">Orders</h1>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-charcoal/10">
          {!orders ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <p className="p-6 text-sm text-charcoal/40">No orders match this filter.</p>
          ) : (
            orders.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setSelectedId(o.id);
                  setSearchParams({ orderId: o.id });
                }}
                className={`w-full text-left px-5 py-3 hover:bg-charcoal/[0.02] ${selectedId === o.id ? "bg-marigold/10" : ""}`}
              >
                <div className="flex justify-between">
                  <p className="font-semibold text-sm">{o.orderNumber}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-charcoal/50 mt-1">{o.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${o.table?.tableNumber}`} · ₹{Number(o.totalAmount).toFixed(0)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {error && <ErrorBanner message={error} />}
        {!selected ? (
          <p className="text-charcoal/40">Select an order to view details.</p>
        ) : (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-2xl">{selected.orderNumber}</h2>
              <StatusBadge status={selected.paymentStatus} />
            </div>
            <p className="text-sm text-charcoal/50 mb-6">
              {selected.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${selected.table?.tableNumber}`}{" "}
              {selected.customerName ? `· ${selected.customerName}` : ""}
            </p>

            <div className="card p-5 mb-5">
              <h3 className="font-semibold text-sm mb-3">Items</h3>
              <div className="space-y-2 text-sm">
                {selected.items?.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between">
                      <span>{item.quantity} × {item.itemName}</span>
                      <span>₹{Number(item.lineTotal).toFixed(0)}</span>
                    </div>
                    {item.instructions && <p className="text-xs text-charcoal/50 italic">"{item.instructions}"</p>}
                  </div>
                ))}
              </div>
              <div className="border-t border-charcoal/10 mt-3 pt-3 space-y-1 text-sm text-charcoal/60">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(selected.subtotal).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{Number(selected.taxAmount).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Service charge</span><span>₹{Number(selected.serviceCharge).toFixed(0)}</span></div>
                <div className="flex justify-between font-semibold text-charcoal text-base pt-1"><span>Total</span><span>₹{Number(selected.totalAmount).toFixed(0)}</span></div>
              </div>
            </div>

            {selected.feedback && (
              <div className="card p-5 mb-5">
                <h3 className="font-semibold text-sm mb-2">Customer Feedback</h3>
                <p className="text-lg mb-1">
                  {"★".repeat(selected.feedback.rating)}
                  {"☆".repeat(5 - selected.feedback.rating)}
                </p>
                {selected.feedback.comment && <p className="text-sm text-charcoal/70">"{selected.feedback.comment}"</p>}
              </div>
            )}

            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3">Update Status</h3>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={selected.status} />
                {(NEXT_STATUS[selected.status] || []).map((s) => (
                  <button key={s} className="btn-secondary py-1.5 px-4 text-xs" onClick={() => changeStatus(selected.id, s)}>
                    Mark {s}
                  </button>
                ))}
                {(NEXT_STATUS[selected.status] || []).length === 0 && (
                  <p className="text-xs text-charcoal/40">No further status changes available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
