const express = require("express");
const authController = require("../controllers/authController");
const restaurantController = require("../controllers/restaurantController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const {
  restaurantCreateSchema,
  restaurantUpdateSchema,
  tableCreateSchema,
  tableUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
} = require("../validators/schemas");

const router = express.Router();

// Self-service onboarding: creates a restaurant + its first ADMIN user.
router.post("/", validateBody(restaurantCreateSchema), authController.registerRestaurant);

router.get("/:id", requireAuth, restaurantController.getRestaurant);
router.put("/:id", requireAuth, requireRole("ADMIN"), validateBody(restaurantUpdateSchema), restaurantController.updateRestaurant);

// Single QR code for the whole restaurant (dine-in table / takeaway is
// chosen by the customer after landing, not baked into the QR).
router.get("/:id/qr", requireAuth, requireRole("ADMIN"), restaurantController.generateRestaurantQr);

// Tables (nested under restaurant for creation/listing, per the spec's API table)
router.get("/:id/tables", requireAuth, restaurantController.listTables);
router.post("/:id/tables", requireAuth, requireRole("ADMIN"), validateBody(tableCreateSchema), restaurantController.createTable);

// Orders list for the dashboard
router.get("/:id/orders", requireAuth, require("../controllers/orderController").listOrders);

// Staff
router.get("/:id/staff", requireAuth, requireRole("ADMIN"), restaurantController.listStaff);
router.post("/:id/staff", requireAuth, requireRole("ADMIN"), validateBody(staffCreateSchema), restaurantController.createStaff);
router.put("/:id/staff/:staffId", requireAuth, requireRole("ADMIN"), validateBody(staffUpdateSchema), (req, res, next) => {
  req.params.id = req.params.staffId; // reuse controller signature (params.id = staff id)
  restaurantController.updateStaff(req, res, next);
});

// Admin menu (full, unfiltered)
router.get("/:id/menu", requireAuth, require("../controllers/menuController").getAdminMenu);

module.exports = router;
