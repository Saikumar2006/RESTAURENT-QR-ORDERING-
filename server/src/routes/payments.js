const express = require("express");
const paymentController = require("../controllers/paymentController");
const { validateBody } = require("../middleware/validate");
const { paymentCreateSchema, paymentVerifySchema } = require("../validators/schemas");

const router = express.Router();

router.post("/create-order", validateBody(paymentCreateSchema), paymentController.createPaymentOrder);
router.post("/verify", validateBody(paymentVerifySchema), paymentController.verifyPayment);

// NOTE: the raw-body webhook route is mounted separately in app.js (before
// the global express.json() parser) so we can verify Razorpay's HMAC
// signature over the exact raw bytes it signed.

module.exports = router;
