import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner } from "../../components/Ui.jsx";

export default function AdminReports() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 500 } }).then(setOrders);
  }, []);

  if (!orders) return <Spinner label="Crunching numbers..." />;

  const paid = orders.filter((o) => o.paymentStatus === "PAID");
  const revenue = paid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const completed = orders.filter((o) => o.status === "COMPLETED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  const avgOrderValue = paid.length ? revenue / paid.length : 0;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-3xl mb-6">Reports</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Total Orders" value={orders.length} />
        <Stat label="Total Revenue (paid)" value={`₹${revenue.toFixed(0)}`} />
        <Stat label="Completed Orders" value={completed} />
        <Stat label="Cancelled Orders" value={cancelled} />
        <Stat label="Average Order Value" value={`₹${avgOrderValue.toFixed(0)}`} />
        <Stat label="Paid Orders" value={paid.length} />
      </div>
      <p className="text-xs text-charcoal/40">
        This is an MVP summary computed from recent orders. Advanced analytics (trends, item-level breakdowns, exports) are part of the future roadmap.
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-charcoal/50 mb-1">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}
