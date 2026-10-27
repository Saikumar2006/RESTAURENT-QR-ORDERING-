const crypto = require("crypto");
const env = require("../config/env");
const { ApiError } = require("../utils/http");

let razorpayClient;
function client() {
  if (!env.saasRazorpayKeyId || !env.saasRazorpayKeySecret) throw new ApiError(503, "Subscription checkout is not configured yet.");
  if (!razorpayClient) {
    const Razorpay = require("razorpay");
    razorpayClient = new Razorpay({ key_id: env.saasRazorpayKeyId, key_secret: env.saasRazorpayKeySecret });
  }
  return razorpayClient;
}

function safeCompare(actual, expected) {
  const left = Buffer.from(actual || "", "utf8");
  const right = Buffer.from(expected || "", "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSignature(secret, rawBody) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function verifyWebhookSignature(rawBody, signature, secret = env.saasRazorpayWebhookSecret) {
  if (!secret) return false;
  return safeCompare(signature, createSignature(secret, rawBody));
}

const razorpay = {
  name: "razorpay",
  createOrder({ amount, currency, receipt }) {
    return client().orders.create({ amount: Math.round(amount * 100), currency, receipt });
  },
  async verifyPayment({ providerOrderId, providerPaymentId, providerSignature }) {
    const expected = crypto.createHmac("sha256", env.saasRazorpayKeySecret)
      .update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
    return safeCompare(providerSignature, expected);
  },
  fetchPayment(paymentId) { return client().payments.fetch(paymentId); },
  verifyWebhookSignature(rawBody, signature) {
    return verifyWebhookSignature(rawBody, signature);
  },
};

function getSaasPaymentProvider() {
  if (env.saasPaymentProvider === "razorpay"
      && env.saasRazorpayKeyId && env.saasRazorpayKeySecret && env.saasRazorpayWebhookSecret) return razorpay;
  throw new ApiError(503, "Subscription checkout is not configured yet.");
}

module.exports = { getSaasPaymentProvider, createSignature, verifyWebhookSignature };
