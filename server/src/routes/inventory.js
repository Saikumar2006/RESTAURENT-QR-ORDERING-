const express = require("express");
const inventoryController = require("../controllers/inventoryController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const {
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
  inventorySupplierCreateSchema,
  inventorySupplierUpdateSchema,
  inventoryPurchaseSchema,
  inventoryReportQuerySchema,
  recipeComponentsSchema,
} = require("../validators/schemas");
const { validateQuery } = require("../middleware/validate");

const router = express.Router();
router.use(requireAuth);

router.get("/items", requirePermission("inventory.view"), inventoryController.listItems);
router.get("/report", requirePermission("inventory.view"), validateQuery(inventoryReportQuerySchema), inventoryController.getReport);
router.get("/suppliers", requirePermission("inventory.view"), inventoryController.listSuppliers);
router.post("/suppliers", requirePermission("inventory.manage"), validateBody(inventorySupplierCreateSchema), inventoryController.createSupplier);
router.put("/suppliers/:supplierId", requirePermission("inventory.manage"), validateBody(inventorySupplierUpdateSchema), inventoryController.updateSupplier);
router.get("/purchases", requirePermission("inventory.view"), inventoryController.listPurchases);
router.post("/purchases", requirePermission("inventory.manage"), validateBody(inventoryPurchaseSchema), inventoryController.createPurchase);
router.post("/items", requirePermission("inventory.manage"), validateBody(inventoryItemCreateSchema), inventoryController.createItem);
router.put("/items/:itemId", requirePermission("inventory.manage"), validateBody(inventoryItemUpdateSchema), inventoryController.updateItem);
router.get("/items/:itemId/movements", requirePermission("inventory.view"), inventoryController.listMovements);
router.post("/items/:itemId/movements", requirePermission("inventory.manage"), validateBody(inventoryMovementSchema), inventoryController.postMovement);
router.get("/menu-items", requirePermission("inventory.view"), inventoryController.getMenu);
router.put("/menu-items/:menuItemId/recipe", requirePermission("inventory.manage"), validateBody(recipeComponentsSchema), inventoryController.setRecipe);

module.exports = router;
