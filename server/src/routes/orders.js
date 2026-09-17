const express = require("express");
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { orderCreateSchema, orderStatusSchema, feedbackCreateSchema } = require("../validators/schemas");

const router = express.Router();

// Public: guest creates an order.
router.post("/", validateBody(orderCreateSchema), orderController.createOrder);

// Reachable by guest (?orderSessionToken=...) or authenticated staff/admin.
router.get("/:id", optionalAuth, orderController.getOrder);

// Public: guest rates their own completed order (orderSessionToken in body).
router.post("/:id/feedback", validateBody(feedbackCreateSchema), orderController.submitFeedback);

router.put("/:id/status", requireAuth, requireRole("ADMIN", "STAFF"), validateBody(orderStatusSchema), orderController.updateOrderStatus);

module.exports = router;
