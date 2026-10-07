import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../../store/CartContext.jsx";
import { EmptyState, ErrorBanner } from "../../components/Ui.jsx";
import api from "../../services/api";
import { saveOrderToHistory } from "../../utils/orderHistory.js";

export default function Cart() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, updateQuantity, setInstructions, removeItem, subtotal, clearCart, session } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountAmount }

  // Phone OTP verification — only relevant when the restaurant requires it
  const phoneVerificationRequired = session?.restaurant?.phoneVerificationEnabled;
  const [otpStep, setOtpStep] = useState("idle"); // idle | sent | verified
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState(null);

  function handlePhoneChange(value) {
    setCustomerPhone(value);
    // The verification token is bound to the exact phone number it was
    // issued for — any edit invalidates it, so don't let a stale
    // "verified" checkmark linger for a number that's since changed.
    if (otpStep !== "idle") {
      setOtpStep("idle");
      setOtpCode("");
      setPhoneVerificationToken(null);
      setOtpError(null);
    }
  }

  async function sendOtp() {
    if (!customerPhone.trim()) {
      setOtpError("Enter your phone number first.");
      return;
    }
    setSendingOtp(true);
    setOtpError(null);
    try {
      const result = await api.post(`/public/restaurants/${slug}/otp/send`, { phone: customerPhone.trim() });
      setCustomerPhone(result.phone);
      setOtpStep("sent");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (otpCode.length !== 6) {
      setOtpError("Enter the 6-digit code.");
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await api.post("/public/otp/verify", { phone: customerPhone.trim(), code: otpCode });
      setPhoneVerificationToken(result.phoneVerificationToken);
      setOtpStep("verified");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function applyCoupon(e) {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await api.post(`/public/restaurants/${slug}/coupons/validate`, {
        code: couponInput.trim(),
        subtotal,
      });
      setAppliedCoupon(result);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  // Displayed totals are advisory only — the backend recalculates tax,
  // service charge, discount and grand total authoritatively when the
  // order is placed (it re-validates the coupon server-side too).
  async function placeOrder() {
    if (!session) {
      navigate(`/r/${slug}`, { replace: true });
      return;
    }
    if (phoneVerificationRequired && otpStep !== "verified") {
      setError("Please verify your phone number before placing your order.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.post("/orders", {
        slug,
        orderType: session.orderType,
        tableToken: session.orderType === "DINE_IN" ? session.tableToken : undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        phoneVerificationToken: phoneVerificationToken || undefined,
        couponCode: appliedCoupon?.code || undefined,
        latitude: session.location?.lat,
        longitude: session.location?.lng,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          instructions: i.instructions || undefined,
        })),
      });
      clearCart();
      saveOrderToHistory(slug, order);
      navigate(`/r/${slug}/pay`, { state: { order } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <EmptyState title="Your cart is empty" subtitle="Add something delicious from the menu." />
        <button className="btn-secondary mt-4" onClick={() => navigate(`/r/${slug}/menu`)}>
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40">
      <header className="px-5 pt-6 pb-2">
        <button className="text-sm text-charcoal/50 mb-3" onClick={() => navigate(`/r/${slug}/menu`)}>
          ← Back to menu
        </button>
        <h1 className="font-display text-2xl">Your Order</h1>
        <p className="text-xs text-charcoal/50">
          {session?.orderType === "TAKEAWAY" ? "Takeaway" : `Table ${session?.tableNumber}`}
        </p>
      </header>

      <main className="px-5 py-4 space-y-4">
        {error && <ErrorBanner message={error} />}
        {items.map((item) => (
          <div key={item.menuItemId} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-charcoal/50">₹{item.price.toFixed(0)} each</p>
              </div>
              <button className="text-xs text-charcoal/40" onClick={() => removeItem(item.menuItemId)}>
                Remove
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button
                  className="w-7 h-7 rounded-full border border-charcoal/20 flex items-center justify-center"
                  onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                >
                  −
                </button>
                <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  className="w-7 h-7 rounded-full bg-clove text-cream flex items-center justify-center"
                  onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <span className="font-semibold text-sm">₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
            <input
              className="input mt-3 text-xs"
              placeholder="Add a note (e.g. less spicy)"
              value={item.instructions}
              onChange={(e) => setInstructions(item.menuItemId, e.target.value)}
            />
          </div>
        ))}

        <div className="card p-4 space-y-2">
          <input className="input" placeholder="Your name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          {phoneVerificationRequired ? (
            <div>
              <div className="flex gap-2">
                <input
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone number (include country code, e.g. +919876543210)"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={otpStep === "verified"}
                />
                {otpStep !== "verified" && (
                  <button
                    type="button"
                    className="btn-secondary shrink-0 text-sm"
                    onClick={sendOtp}
                    disabled={sendingOtp || !customerPhone.trim()}
                  >
                    {sendingOtp ? "Sending..." : otpStep === "sent" ? "Resend" : "Send Code"}
                  </button>
                )}
                {otpStep === "verified" && <span className="text-emerald-600 text-sm font-medium self-center shrink-0">✓ Verified</span>}
              </div>
              {otpStep === "sent" && (
                <div className="flex gap-2 mt-2">
                  <input
                    className="input"
                    placeholder="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <button type="button" className="btn-primary shrink-0 text-sm" onClick={verifyOtp} disabled={verifyingOtp}>
                    {verifyingOtp ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
              {otpError && <p className="text-xs text-red-600 mt-1">{otpError}</p>}
              <p className="text-xs text-charcoal/40 mt-1">This restaurant requires a verified phone number to place an order.</p>
            </div>
          ) : (
            <input className="input" placeholder="Phone number (optional, for order updates)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-2">Have a coupon?</h3>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">
                {appliedCoupon.code} applied — −₹{appliedCoupon.discountAmount.toFixed(0)}
              </span>
              <button type="button" className="text-xs underline" onClick={removeCoupon}>
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={applyCoupon} className="flex gap-2">
              <input
                className="input"
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              />
              <button className="btn-secondary shrink-0" type="submit" disabled={applyingCoupon}>
                {applyingCoupon ? "Checking..." : "Apply"}
              </button>
            </form>
          )}
          {couponError && <p className="text-xs text-red-600 mt-2">{couponError}</p>}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-charcoal/10 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-charcoal/60 mb-1">
            <span>Subtotal (est.)</span>
            <span>₹{subtotal.toFixed(0)}</span>
          </div>
          {appliedCoupon && (
            <div className="flex justify-between text-sm text-emerald-600 font-medium mb-1">
              <span>Coupon discount</span>
              <span>−₹{appliedCoupon.discountAmount.toFixed(0)}</span>
            </div>
          )}
          <p className="text-xs text-charcoal/40 mb-3">Tax & service charges are calculated at checkout.</p>
          <button className="btn-primary w-full" onClick={placeOrder} disabled={submitting || (phoneVerificationRequired && otpStep !== "verified")}>
            {submitting ? "Placing order..." : "Place Order & Pay"}
          </button>
        </div>
      </div>
    </div>
  );
}
