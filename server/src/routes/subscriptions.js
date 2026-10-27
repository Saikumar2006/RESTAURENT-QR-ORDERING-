const express = require("express");
const rateLimit = require("express-rate-limit");
const { redisRateLimit } = require("../middleware/distributedRateLimit");
const env = require("../config/env");
const { validateBody } = require("../middleware/validate");
const {
  onboardingTrialSchema,
  onboardingCheckoutSchema,
  subscriptionVerifySchema,
  subscriptionRenewSchema,
} = require("../validators/schemas");
const controller = require("../controllers/subscriptionController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const onboardingLimit = env.redisUrl
  ? redisRateLimit({ prefix: "onboarding", windowMs: 60 * 60 * 1000, limit: 5, keyFn: (req) => req.ip })
  : rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

router.get("/plans", controller.getPlans);
router.post("/onboarding/trial", onboardingLimit, validateBody(onboardingTrialSchema), controller.startTrial);
router.post("/onboarding/checkout", onboardingLimit, validateBody(onboardingCheckoutSchema), controller.createCheckout);
router.post("/onboarding/verify", validateBody(subscriptionVerifySchema), controller.verifyCheckout);
router.get("/current", requireAuth, controller.getCurrent);
router.post("/renewal", requireAuth, requireRole("ADMIN"), validateBody(subscriptionRenewSchema), controller.createRenewal);

module.exports = router;
