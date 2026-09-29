import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Payment() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const order = state?.order;
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!order) return;
    api
      .post("/payments/create-order", { orderId: order.id, orderSessionToken: order.orderSessionToken })
      .then(setPaymentOrder)
      .catch((err) => setError(err.message));
  }, [order]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-xl mb-2">No order to pay for</p>
          <button className="btn-secondary mt-3" onClick={() => navigate(`/r/${slug}/menu`)}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  async function verify(payload) {
    setProcessing(true);
    try {
      await api.post("/payments/verify", {
        orderId: order.id,
        orderSessionToken: order.orderSessionToken,
        ...payload,
      });
      navigate(`/r/${slug}/confirmation`, { state: { order } });
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  }

  async function payWithRazorpay() {
    const loaded = await loadRazorpayScript();
    if (!loaded) return setError("Could not load payment checkout. Check your connection and try again.");

    const rzp = new window.Razorpay({
      key: paymentOrder.razorpayKeyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "QR Ordering",
      description: `Order ${order.orderNumber}`,
      order_id: paymentOrder.providerOrderId,
      handler: (response) =>
        verify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => setError("Payment was cancelled. You can try again.") },
      theme: { color: "#7A2E2E" },
    });
    rzp.open();
  }

  // Mock provider: lets the whole flow be demoed/tested without real
  // payment credentials. Not used when PAYMENT_PROVIDER=razorpay.
  function payMockSuccess() {
    verify({
      razorpay_order_id: paymentOrder.providerOrderId,
      razorpay_payment_id: "mock_pay_" + Math.random().toString(16).slice(2),
      razorpay_signature: "mock_signature",
    });
  }

  function payMockFail() {
    verify({
      razorpay_order_id: paymentOrder.providerOrderId,
      razorpay_payment_id: "fail_" + Math.random().toString(16).slice(2),
      razorpay_signature: "mock_signature",
    }).catch(() => {});
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">Order {order.orderNumber}</p>
      <h1 className="font-display text-3xl mb-6">₹{Number(order.totalAmount).toFixed(0)}</h1>

      {error && <ErrorBanner message={error} />}

      {!paymentOrder ? (
        <Spinner label="Preparing checkout..." />
      ) : processing ? (
        <Spinner label="Verifying payment..." />
      ) : paymentOrder.provider === "razorpay" ? (
        <button className="btn-primary w-full max-w-xs" onClick={payWithRazorpay}>
          Pay Now
        </button>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <p className="text-xs text-charcoal/40 mb-2">Test mode — simulate a payment outcome</p>
          <button className="btn-primary w-full" onClick={payMockSuccess}>
            Simulate Successful Payment
          </button>
          <button className="btn-secondary w-full" onClick={payMockFail}>
            Simulate Failed Payment
          </button>
        </div>
      )}
    </div>
  );
}
