const express = require("express");
const restaurantController = require("../controllers/restaurantController");
const orderController = require("../controllers/orderController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { tableUpdateSchema, addOrderItemsSchema } = require("../validators/schemas");

const router = express.Router();

router.get("/:id/active-order", requireAuth, requirePermission("orders.view"), orderController.getActiveOrderForTable);
router.post("/:id/active-order/items", requireAuth, requirePermission("orders.update"), validateBody(addOrderItemsSchema), orderController.addItemsToActiveOrder);
router.put("/:id", requireAuth, requirePermission("tables.manage"), validateBody(tableUpdateSchema), restaurantController.updateTable);
router.delete("/:id", requireAuth, requirePermission("tables.manage"), restaurantController.disableTable);

module.exports = router;
