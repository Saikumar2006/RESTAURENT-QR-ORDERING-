const express = require("express");
const couponController = require("../controllers/couponController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { couponCreateSchema, couponUpdateSchema } = require("../validators/schemas");

const router = express.Router();

router.get("/", requireAuth, requireRole("ADMIN"), couponController.listCoupons);
router.post("/", requireAuth, requireRole("ADMIN"), validateBody(couponCreateSchema), couponController.createCoupon);
router.put("/:id", requireAuth, requireRole("ADMIN"), validateBody(couponUpdateSchema), couponController.updateCoupon);
router.delete("/:id", requireAuth, requireRole("ADMIN"), couponController.deleteCoupon);

module.exports = router;
