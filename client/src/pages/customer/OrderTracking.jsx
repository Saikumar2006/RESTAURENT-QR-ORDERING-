import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../store/CartContext.jsx";
import { getSocket, joinOrderRoom } from "../../sockets/socket";
import { Spinner, StatusBadge } from "../../components/Ui.jsx";
import { getStoredOrder, buildReorderPlan } from "../../utils/orderHistory.js";

const STEPS = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
const STEP_LABELS = {
  PENDING: "Order Confirmed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
};

export default function OrderTracking() {
  const { slug, orderId: orderIdParam } = useParams();
  const { state, search } = useLocation();
  const navigate = useNavigate();
  const { session, addItem } = useCart();
  const orderFromState = state?.order;
  const queryToken = new URLSearchParams(search).get("t");
  // Three ways to land here, in priority order: fresh from Cart/Payment
  // (router state, has everything), a refresh on this device (fall back to
  // local order history), or a WhatsApp/SMS tracking link opened fresh
  // (falls back to the ?t= token embedded in that link — see
  // orderService.js's order confirmation message).
  const storedOrder = !orderFromState && orderIdParam ? getStoredOrder(slug, orderIdParam) : null;

  const [order, setOrder] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(orderFromState?.paymentStatus);
  const [notFound, setNotFound] = useState(false);

  const orderId = orderFromState?.id || storedOrder?.id || (queryToken ? orderIdParam : null);
  const orderSessionToken = orderFromState?.orderSessionToken || storedOrder?.orderSessionToken || queryToken;

  // Feedback state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  // Order again state
  const [reordering, setReordering] = useState(false);
  const [reorderNotice, setReorderNotice] = useState(null);

  async function refresh() {
    if (!orderId || !orderSessionToken) return;
    try {
      const data = await api.get(`/orders/${orderId}?orderSessionToken=${orderSessionToken}`);
      setOrder(data);
      setPaymentStatus(data.paymentStatus);
    } catch {
      setNotFound(true);
    }
  }

  useEffect(() => {
    refresh();
    if (!orderSessionToken) return;
    joinOrderRoom(orderSessionToken);
    const socket = getSocket();

    const onStatus = () => refresh();
    const onPayment = () => refresh();
    // After any reconnect, fetch authoritative state from the API rather
    // than trusting that no events were missed while disconnected.
    const onConnect = () => refresh();

    socket.on("order:status", onStatus);
    socket.on("payment:updated", onPayment);
    socket.on("connect", onConnect);
    return () => {
      socket.off("order:status", onStatus);
      socket.off("payment:updated", onPayment);
      socket.off("connect", onConnect);
    };
  }, [orderId, orderSessionToken]);

  async function submitFeedback() {
    if (rating < 1) return;
    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await api.post(`/orders/${orderId}/feedback`, { orderSessionToken, rating, comment: comment || undefined });
      await refresh();
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function orderAgain() {
    if (!session || session.slug !== slug) {
      navigate(`/r/${slug}`);
      return;
    }
    setReordering(true);
    setReorderNotice(null);
    try {
      const categories = await api.get(`/public/restaurants/${slug}/menu`);
      const historyItems = (order?.items || []).map((i) => ({ menuItemId: i.menuItemId, name: i.itemName, quantity: i.quantity }));
      const { toAdd, skipped } = buildReorderPlan(historyItems, categories);
      toAdd.forEach(({ menuItem, quantity }) => addItem(menuItem, quantity));
      if (toAdd.length === 0) {
        setReorderNotice("None of these items are available anymore.");
        return;
      }
      if (skipped.length > 0) {
        setReorderNotice(`Added what's still available. No longer on the menu: ${skipped.join(", ")}.`);
        setTimeout(() => navigate(`/r/${slug}/cart`), 1400);
      } else {
        navigate(`/r/${slug}/cart`);
      }
    } catch (err) {
      setReorderNotice(err.message);
    } finally {
      setReordering(false);
    }
  }

  if (!orderId || !orderSessionToken || notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="font-display text-xl">No order found for this session.</p>
        {slug && (
          <button className="btn-secondary" onClick={() => navigate(`/r/${slug}/orders`)}>
            View your orders
          </button>
        )}
      </div>
    );
  }

  const current = order || orderFromState;
  if (!current) {
    return <Spinner label="Loading order..." />;
  }
  const currentIndex = STEPS.indexOf(current.status);

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">Order</p>
        <h1 className="font-display text-3xl mb-2">{current.orderNumber}</h1>
        <div className="flex items-center justify-center gap-2">
          <StatusBadge status={current.status} />
          <StatusBadge status={paymentStatus} />
        </div>
      </div>

      {!order ? (
        <Spinner label="Loading order..." />
      ) : current.status === "CANCELLED" ? (
        <div className="card p-6 text-center">
          <p className="font-semibold mb-1">This order was cancelled</p>
          <p className="text-sm text-charcoal/50">Please speak to restaurant staff if you have questions.</p>
        </div>
      ) : (
        <div className="card p-6 mb-6">
          <ol className="space-y-5">
            {STEPS.map((step, idx) => {
              const done = idx <= currentIndex;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      done ? "bg-clove text-cream" : "bg-charcoal/10 text-charcoal/30"
                    }`}
                  >
                    {done ? "✓" : idx + 1}
                  </span>
                  <span className={done ? "font-medium" : "text-charcoal/40"}>{STEP_LABELS[step]}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-semibold mb-3 text-sm">Order Summary</h2>
        <div className="space-y-1 text-sm">
          {current.items?.map((item) => (
            <div key={item.id || item.menuItemId} className="flex justify-between text-charcoal/70">
              <span>{item.quantity} × {item.itemName || item.name}</span>
              <span>₹{Number(item.lineTotal || item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-charcoal/10 mt-3 pt-3 space-y-1">
          {current.subtotal != null && (
            <div className="flex justify-between text-charcoal/60 text-xs">
              <span>Subtotal</span>
              <span>₹{Number(current.subtotal).toFixed(0)}</span>
            </div>
          )}
          {current.taxAmount > 0 && (
            <div className="flex justify-between text-charcoal/60 text-xs">
              <span>Tax</span>
              <span>₹{Number(current.taxAmount).toFixed(0)}</span>
            </div>
          )}
          {current.serviceCharge > 0 && (
            <div className="flex justify-between text-charcoal/60 text-xs">
              <span>Service charge</span>
              <span>₹{Number(current.serviceCharge).toFixed(0)}</span>
            </div>
          )}
          {current.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 text-xs font-medium">
              <span>Discount{current.couponCode ? ` (${current.couponCode})` : ""}</span>
              <span>−₹{Number(current.discountAmount).toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1">
            <span>Total</span>
            <span>₹{Number(current.totalAmount).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {current.status === "COMPLETED" && (
        <div className="card p-4 mt-4">
          {current.feedback ? (
            <div className="text-center py-2">
              <p className="text-2xl mb-1">{"★".repeat(current.feedback.rating)}{"☆".repeat(5 - current.feedback.rating)}</p>
              <p className="text-sm text-charcoal/60">Thanks for your feedback!</p>
            </div>
          ) : (
            <>
              <h2 className="font-semibold mb-2 text-sm">How was your order?</h2>
              <div className="flex gap-1 mb-3 text-2xl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                    {n <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="Tell us more (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {feedbackError && <p className="text-xs text-red-600 mt-2">{feedbackError}</p>}
              <button
                className="btn-primary w-full mt-3"
                onClick={submitFeedback}
                disabled={rating < 1 || submittingFeedback}
              >
                {submittingFeedback ? "Submitting..." : "Submit Feedback"}
              </button>
            </>
          )}
        </div>
      )}

      {reorderNotice && <p className="text-xs text-charcoal/60 mt-4 text-center">{reorderNotice}</p>}

      <div className="flex gap-2 mt-4">
        <button className="btn-secondary flex-1 text-sm" onClick={() => navigate(`/r/${slug}/orders`)}>
          Your Orders
        </button>
        <button className="btn-primary flex-1 text-sm" onClick={orderAgain} disabled={reordering}>
          {reordering ? "Adding..." : "Order Again"}
        </button>
      </div>
    </div>
  );
}
