const express = require("express");
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { orderCreateSchema, orderStatusSchema, feedbackCreateSchema } = require("../validators/schemas");
const env = require("../config/env");
const { redisRateLimit } = require("../middleware/distributedRateLimit");

const router = express.Router();

// Public: guest creates an order. Apply a Redis-backed per-IP limiter when
// REDIS_URL is present; otherwise no per-route limiter (global in-memory
// limiter may still apply in non-production).
const orderCreateLimiter = env.redisUrl ? redisRateLimit({ prefix: "orders:create", windowMs: 60 * 1000, limit: 10, keyFn: (req) => req.ip }) : (req, res, next) => next();

router.post("/", orderCreateLimiter, validateBody(orderCreateSchema), orderController.createOrder);

// Reachable by guest (?orderSessionToken=...) or authenticated staff/admin.
router.get("/:id", optionalAuth, orderController.getOrder);

// Public: guest rates their own completed order (orderSessionToken in body).
router.post("/:id/feedback", validateBody(feedbackCreateSchema), orderController.submitFeedback);

router.put("/:id/status", requireAuth, requireRole("ADMIN", "STAFF"), validateBody(orderStatusSchema), orderController.updateOrderStatus);

module.exports = router;
