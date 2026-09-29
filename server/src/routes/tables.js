const express = require("express");
const restaurantController = require("../controllers/restaurantController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { tableUpdateSchema } = require("../validators/schemas");

const router = express.Router();

router.put("/:id", requireAuth, requireRole("ADMIN"), validateBody(tableUpdateSchema), restaurantController.updateTable);
router.delete("/:id", requireAuth, requireRole("ADMIN"), restaurantController.disableTable);

module.exports = router;
