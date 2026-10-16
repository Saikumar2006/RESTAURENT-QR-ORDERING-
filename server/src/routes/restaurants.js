const express = require("express");
const authController = require("../controllers/authController");
const restaurantController = require("../controllers/restaurantController");
const insightsController = require("../controllers/restaurantInsightsController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const {
  restaurantCreateSchema,
  restaurantUpdateSchema,
  tableCreateSchema,
  tableUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  roleCreateSchema,
  roleUpdateSchema,
  rolePermissionsSchema,
  manualOrderCreateSchema,
} = require("../validators/schemas");
const roleController = require("../controllers/roleController");

const router = express.Router();

// Self-service onboarding: creates a restaurant + its first ADMIN user.
router.post("/", validateBody(restaurantCreateSchema), authController.registerRestaurant);

router.get("/:id", requireAuth, requirePermission("restaurant.view"), restaurantController.getRestaurant);
router.put("/:id", requireAuth, requirePermission("restaurant.update"), validateBody(restaurantUpdateSchema), restaurantController.updateRestaurant);

// Single QR code for the whole restaurant (dine-in table / takeaway is
// chosen by the customer after landing, not baked into the QR).
router.get("/:id/qr", requireAuth, requirePermission("tables.qr.manage"), restaurantController.generateRestaurantQr);

// Tables (nested under restaurant for creation/listing, per the spec's API table)
router.get("/:id/tables", requireAuth, requirePermission("tables.view"), restaurantController.listTables);
router.post("/:id/tables", requireAuth, requirePermission("tables.manage"), validateBody(tableCreateSchema), restaurantController.createTable);

// Orders list for the dashboard
router.get("/:id/orders", requireAuth, requirePermission("orders.view"), require("../controllers/orderController").listOrders);
router.post("/:id/orders/manual", requireAuth, requirePermission("orders.create"), validateBody(manualOrderCreateSchema), require("../controllers/orderController").createManualOrder);
router.get("/:id/integrations/status", requireAuth, requirePermission("orders.view"), (req, res, next) => {
  if (req.params.id !== req.user.restaurantId) return res.status(403).json({ success: false, message: "Forbidden" });
  res.json({ success: true, data: require("../services/orderProviders").listProviderStatus() });
});
router.get("/:id/analytics", requireAuth, requirePermission("analytics.view"), insightsController.getAnalytics);
router.get("/:id/customers", requireAuth, requirePermission("analytics.view"), insightsController.getCustomers);

// Staff
router.get("/:id/staff", requireAuth, requirePermission("staff.view"), restaurantController.listStaff);
router.post("/:id/staff", requireAuth, requirePermission("staff.create"), validateBody(staffCreateSchema), restaurantController.createStaff);
router.put("/:id/staff/:staffId", requireAuth, requirePermission("staff.update"), validateBody(staffUpdateSchema), (req, res, next) => {
  req.params.id = req.params.staffId; // reuse controller signature (params.id = staff id)
  restaurantController.updateStaff(req, res, next);
});

router.get("/:id/roles", requireAuth, requirePermission("staff.view"), roleController.list);
router.post("/:id/roles", requireAuth, requirePermission("staff.roles.manage"), validateBody(roleCreateSchema), roleController.create);
router.put("/:id/roles/:roleId", requireAuth, requirePermission("staff.roles.manage"), validateBody(roleUpdateSchema), roleController.update);
router.put("/:id/roles/:roleId/permissions", requireAuth, requirePermission("staff.roles.manage"), validateBody(rolePermissionsSchema), roleController.setPermissions);
router.delete("/:id/roles/:roleId", requireAuth, requirePermission("staff.roles.manage"), roleController.remove);
router.get("/:id/audit-log", requireAuth, requirePermission("audit.view"), roleController.auditLog);

// Admin menu (full, unfiltered)
router.get("/:id/menu", requireAuth, requirePermission("menu.view"), require("../controllers/menuController").getAdminMenu);

module.exports = router;
