import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../store/CartContext.jsx";
import { Spinner, StatusBadge, EmptyState } from "../../components/Ui.jsx";
import { getOrderHistory, buildReorderPlan } from "../../utils/orderHistory.js";

export default function OrderHistory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { session, addItem } = useCart();
  const [orders, setOrders] = useState(null); // history entries merged with live status
  const [reorderingId, setReorderingId] = useState(null);
  const [reorderNotice, setReorderNotice] = useState(null);

  useEffect(() => {
    const history = getOrderHistory(slug);
    if (history.length === 0) {
      setOrders([]);
      return;
    }
    // Each entry's own orderSessionToken is its auth — fetch live status for
    // all of them so this list reflects reality, not just what was true at
    // order time.
    Promise.all(
      history.map((h) =>
        api
          .get(`/orders/${h.id}?orderSessionToken=${h.orderSessionToken}`)
          .then((live) => ({ ...h, status: live.status, totalAmount: live.totalAmount }))
          .catch(() => ({ ...h, status: null })) // order lookup failed (e.g. deleted) — still show what we have
      )
    ).then(setOrders);
  }, [slug]);

  async function orderAgain(entry) {
    if (!session || session.slug !== slug) {
      navigate(`/r/${slug}`);
      return;
    }
    setReorderingId(entry.id);
    setReorderNotice(null);
    try {
      const categories = await api.get(`/public/restaurants/${slug}/menu`);
      const { toAdd, skipped } = buildReorderPlan(entry.items, categories);
      toAdd.forEach(({ menuItem, quantity }) => addItem(menuItem, quantity));
      if (toAdd.length === 0) {
        setReorderNotice({ type: "error", text: "None of these items are available anymore." });
        return;
      }
      if (skipped.length > 0) {
        setReorderNotice({ type: "warn", text: `Added what's still available. No longer on the menu: ${skipped.join(", ")}.` });
        setTimeout(() => navigate(`/r/${slug}/cart`), 1400);
      } else {
        navigate(`/r/${slug}/cart`);
      }
    } catch (err) {
      setReorderNotice({ type: "error", text: err.message });
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <button className="text-sm text-charcoal/50 mb-4" onClick={() => navigate(`/r/${slug}/menu`)}>
        ← Back to menu
      </button>
      <h1 className="font-display text-2xl mb-1">Your Orders</h1>
      <p className="text-xs text-charcoal/50 mb-6">Orders placed from this device at this restaurant.</p>

      {reorderNotice && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-4 ${reorderNotice.type === "error" ? "bg-red-50 text-red-700" : "bg-marigold/15 text-charcoal/70"}`}>
          {reorderNotice.text}
        </div>
      )}

      {!orders ? (
        <Spinner label="Loading your orders..." />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" subtitle="Orders you place will show up here." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm">{o.orderNumber}</p>
                {o.status && <StatusBadge status={o.status} />}
              </div>
              <p className="text-xs text-charcoal/50 mb-2">
                {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {" · "}
                {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">₹{Number(o.totalAmount).toFixed(0)}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => navigate(`/r/${slug}/order/${o.id}`)}>
                    View
                  </button>
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    onClick={() => orderAgain(o)}
                    disabled={reorderingId === o.id}
                  >
                    {reorderingId === o.id ? "Adding..." : "Order Again"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
