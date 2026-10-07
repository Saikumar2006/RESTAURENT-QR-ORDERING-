const express = require("express");
const rateLimit = require("express-rate-limit");
const menuController = require("../controllers/menuController");
const couponController = require("../controllers/couponController");
const otpController = require("../controllers/otpController");
const { validateBody } = require("../middleware/validate");
const { couponValidateSchema, otpSendSchema, otpVerifySchema } = require("../validators/schemas");

const router = express.Router();

// OTP sends have a tighter IP limit; otpService also enforces cooldown and
// hourly limits per canonical phone number in the database.
const otpSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const otpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Single QR per restaurant: the landing page resolves restaurant + table
// list from the slug, then the customer picks dine-in table or takeaway.
router.get("/restaurants/:slug", menuController.getPublicRestaurantContext);
router.get("/restaurants/:slug/menu", menuController.getPublicMenuBySlug);
router.post(
  "/restaurants/:slug/coupons/validate",
  validateBody(couponValidateSchema),
  couponController.validatePublicCoupon
);

router.post("/restaurants/:slug/otp/send", otpSendLimiter, validateBody(otpSendSchema), otpController.sendOtp);
router.post("/otp/verify", otpVerifyLimiter, validateBody(otpVerifySchema), otpController.verifyOtp);

module.exports = router;
