const paymentService = require("../services/paymentService");
const { ok, asyncHandler } = require("../utils/http");

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

module.exports = { createPaymentOrder, verifyPayment, webhook };
