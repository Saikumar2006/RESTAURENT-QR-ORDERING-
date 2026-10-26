const paymentService = require("../services/paymentService");
const { ok, asyncHandler } = require("../utils/http");
const env = require("../config/env");

const providerStatus = asyncHandler(async (req, res) => {
  const isRazorpayConfigured = Boolean(env.razorpayKeyId && env.razorpayKeySecret && env.razorpayWebhookSecret);
  const available = env.paymentProvider === "razorpay" ? isRazorpayConfigured
    : env.paymentProvider === "mock" && env.nodeEnv !== "production";
  ok(res, {
    provider: available ? env.paymentProvider : null,
    available,
    mode: env.paymentProvider === "mock" ? "development_test_only" : available ? "platform_configured" : "unconfigured",
    restaurantLinkedAccount: false,
  });
});

const createPaymentOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.createPaymentOrder(req.body.orderId, req.body.orderSessionToken);
  ok(res, result);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyPayment(req.body);
  ok(res, { paymentStatus: result.order.paymentStatus });
});

// Razorpay signs the webhook over the raw request body, so this route is
// mounted with a raw-body parser (see routes/payments.js) rather than JSON.
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const payload = JSON.parse(req.body.toString("utf8"));
  const result = await paymentService.handleWebhook(req.body, signature, payload);
  // Always 200 quickly so the provider doesn't retry-storm us; idempotency
  // is handled inside handleWebhook.
  res.json({ success: true, data: result });
});

module.exports = { createPaymentOrder, verifyPayment, webhook, providerStatus };
