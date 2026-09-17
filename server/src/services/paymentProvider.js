const crypto = require("crypto");
const env = require("../config/env");

// Real Razorpay SDK is only required when actually configured, so the app
// can run and be developed against without live payment credentials.
let razorpayClient = null;
function getRazorpayClient() {
  if (!razorpayClient) {
    const Razorpay = require("razorpay");
    razorpayClient = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }
  return razorpayClient;
}

// --- Mock provider -------------------------------------------------------
// Lets the whole order → pay → verify → webhook flow be exercised locally
// without real payment credentials. Never enabled unless PAYMENT_PROVIDER=mock.
const mockProvider = {
  name: "mock",
  async createOrder({ amount, currency, receipt }) {
    const id = "mock_order_" + crypto.randomBytes(8).toString("hex");
    return { id, amount: Math.round(amount * 100), currency, receipt };
  },
  async verifyPayment({ providerOrderId, providerPaymentId, providerSignature }) {
    // In mock mode any payment id/signature that starts with "mock_" is
    // treated as valid so the frontend can simulate success/failure.
    return Boolean(providerPaymentId && providerPaymentId.startsWith("mock_pay_"));
  },
  verifyWebhookSignature() {
    return true;
  },
};

// Constant-time comparison for HMAC signatures. Plain === leaks timing
// information proportional to how many leading bytes match, which is
// exactly the kind of side channel that makes forging a signature
// byte-by-byte feasible over enough attempts. timingSafeEqual requires
// equal-length buffers, so a length mismatch (which only happens with
// malformed/garbage input, never a real signature) is rejected outright
// rather than passed to it.
function safeCompare(a, b) {
  const bufA = Buffer.from(a || "", "utf8");
  const bufB = Buffer.from(b || "", "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- Razorpay provider -----------------------------------------------------
const razorpayProvider = {
  name: "razorpay",
  async createOrder({ amount, currency, receipt }) {
    const client = getRazorpayClient();
    // Razorpay expects amount in the smallest currency unit (paise for INR).
    const order = await client.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
    });
    return order;
  },
  async verifyPayment({ providerOrderId, providerPaymentId, providerSignature }) {
    const body = `${providerOrderId}|${providerPaymentId}`;
    const expected = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(body)
      .digest("hex");
    return safeCompare(expected, providerSignature);
  },
  verifyWebhookSignature(rawBody, signatureHeader) {
    const expected = crypto
      .createHmac("sha256", env.razorpayWebhookSecret)
      .update(rawBody)
      .digest("hex");
    return safeCompare(expected, signatureHeader);
  },
};

function getPaymentProvider() {
  return env.paymentProvider === "razorpay" ? razorpayProvider : mockProvider;
}

module.exports = { getPaymentProvider };
