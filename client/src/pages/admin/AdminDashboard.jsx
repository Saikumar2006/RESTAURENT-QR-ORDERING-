import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getSocket } from "../../sockets/socket";
import { StatusBadge, Spinner } from "../../components/Ui.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  async function refresh() {
    const data = await api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 20 } });
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
  }, []);

  if (!orders) return <Spinner label="Loading dashboard..." />;

  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status));
  const todaysRevenue = orders
    .filter((o) => o.paymentStatus === "PAID" && isToday(o.createdAt))
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl mb-6">Good day, {user?.name?.split(" ")[0]}</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Orders" value={activeOrders.length} />
        <StatCard label="Orders Today" value={orders.filter((o) => isToday(o.createdAt)).length} />
        <StatCard label="Revenue Today" value={`₹${todaysRevenue.toFixed(0)}`} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/10">
          <h2 className="font-semibold">Live Order Feed</h2>
          <button className="text-sm text-clove font-medium" onClick={() => navigate("/admin/orders")}>
            View all →
          </button>
        </div>
        <div className="divide-y divide-charcoal/10">
          {activeOrders.length === 0 && <p className="p-6 text-sm text-charcoal/40">No active orders right now.</p>}
          {activeOrders.slice(0, 8).map((o) => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-charcoal/[0.02]" onClick={() => navigate(`/admin/orders?orderId=${o.id}`)}>
              <div>
                <p className="font-semibold text-sm">
                  {o.orderNumber} · {o.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${o.table?.tableNumber}`}
                </p>
                <p className="text-xs text-charcoal/50">{o.items?.length} items · ₹{Number(o.totalAmount).toFixed(0)}</p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={o.status} />
                <StatusBadge status={o.paymentStatus} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-charcoal/50 mb-1">{label}</p>
      <p className="font-display text-3xl">{value}</p>
    </div>
  );
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
