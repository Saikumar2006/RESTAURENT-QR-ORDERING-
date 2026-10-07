const express = require("express");
const paymentController = require("../controllers/paymentController");
const { validateBody } = require("../middleware/validate");
const { paymentCreateSchema, paymentVerifySchema } = require("../validators/schemas");
const env = require("../config/env");
const { redisRateLimit } = require("../middleware/distributedRateLimit");

const router = express.Router();

const paymentCreateLimiter = env.redisUrl ? redisRateLimit({ prefix: "payments:create", windowMs: 60 * 1000, limit: 5, keyFn: (req) => req.ip }) : (req, res, next) => next();

router.post("/create-order", paymentCreateLimiter, validateBody(paymentCreateSchema), paymentController.createPaymentOrder);
router.post("/verify", validateBody(paymentVerifySchema), paymentController.verifyPayment);

// NOTE: the raw-body webhook route is mounted separately in app.js (before
// the global express.json() parser) so we can verify Razorpay's HMAC
// signature over the exact raw bytes it signed.

module.exports = router;
