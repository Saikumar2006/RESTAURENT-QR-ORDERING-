const express = require("express");
const menuController = require("../controllers/menuController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { handleImageUpload } = require("../middleware/upload");
const {
  categoryCreateSchema,
  categoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
} = require("../validators/schemas");

const router = express.Router();

router.post("/categories", requireAuth, requirePermission("menu.create"), validateBody(categoryCreateSchema), menuController.createCategory);
router.put("/categories/:id", requireAuth, requirePermission("menu.update"), validateBody(categoryUpdateSchema), menuController.updateCategory);
router.delete("/categories/:id", requireAuth, requirePermission("menu.delete"), menuController.deleteCategory);

router.post("/menu-items/image-upload", requireAuth, requirePermission("menu.create", "menu.update"), handleImageUpload, menuController.uploadImage);

router.post("/menu-items", requireAuth, requirePermission("menu.create"), validateBody(menuItemCreateSchema), menuController.createMenuItem);
router.put("/menu-items/:id", requireAuth, requirePermission("menu.update"), validateBody(menuItemUpdateSchema), menuController.updateMenuItem);
router.delete("/menu-items/:id", requireAuth, requirePermission("menu.delete"), menuController.deleteMenuItem);

module.exports = router;
