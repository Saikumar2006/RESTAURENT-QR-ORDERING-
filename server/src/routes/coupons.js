const express = require("express");
const couponController = require("../controllers/couponController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { couponCreateSchema, couponUpdateSchema } = require("../validators/schemas");

const router = express.Router();

router.get("/", requireAuth, requirePermission("coupons.view"), couponController.listCoupons);
router.post("/", requireAuth, requirePermission("coupons.create"), validateBody(couponCreateSchema), couponController.createCoupon);
router.put("/:id", requireAuth, requirePermission("coupons.update"), validateBody(couponUpdateSchema), couponController.updateCoupon);
router.delete("/:id", requireAuth, requirePermission("coupons.delete"), couponController.deleteCoupon);

module.exports = router;
