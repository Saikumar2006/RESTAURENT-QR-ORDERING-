const express = require("express");
const restaurantController = require("../controllers/restaurantController");
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { tableUpdateSchema, addOrderItemsSchema } = require("../validators/schemas");

const router = express.Router();

router.get("/:id/active-order", requireAuth, requireRole("ADMIN", "STAFF"), orderController.getActiveOrderForTable);
router.post("/:id/active-order/items", requireAuth, requireRole("ADMIN", "STAFF"), validateBody(addOrderItemsSchema), orderController.addItemsToActiveOrder);
router.put("/:id", requireAuth, requireRole("ADMIN"), validateBody(tableUpdateSchema), restaurantController.updateTable);
router.delete("/:id", requireAuth, requireRole("ADMIN"), restaurantController.disableTable);

module.exports = router;
