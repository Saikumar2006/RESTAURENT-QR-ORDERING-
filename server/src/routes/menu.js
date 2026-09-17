const express = require("express");
const menuController = require("../controllers/menuController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { handleImageUpload } = require("../middleware/upload");
const {
  categoryCreateSchema,
  categoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
} = require("../validators/schemas");

const router = express.Router();

router.post("/categories", requireAuth, requireRole("ADMIN"), validateBody(categoryCreateSchema), menuController.createCategory);
router.put("/categories/:id", requireAuth, requireRole("ADMIN"), validateBody(categoryUpdateSchema), menuController.updateCategory);
router.delete("/categories/:id", requireAuth, requireRole("ADMIN"), menuController.deleteCategory);

router.post("/menu-items/image-upload", requireAuth, requireRole("ADMIN"), handleImageUpload, menuController.uploadImage);

router.post("/menu-items", requireAuth, requireRole("ADMIN"), validateBody(menuItemCreateSchema), menuController.createMenuItem);
router.put("/menu-items/:id", requireAuth, requireRole("ADMIN"), validateBody(menuItemUpdateSchema), menuController.updateMenuItem);
router.delete("/menu-items/:id", requireAuth, requireRole("ADMIN"), menuController.deleteMenuItem);

module.exports = router;
