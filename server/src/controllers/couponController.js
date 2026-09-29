const couponService = require("../services/couponService");
const prisma = require("../config/db");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");

const listCoupons = asyncHandler(async (req, res) => {
  const coupons = await couponService.listCoupons(req.user.restaurantId);
  ok(res, coupons);
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.user.restaurantId, req.body);
  created(res, coupon);
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.user.restaurantId, req.params.id, req.body);
  ok(res, coupon);
});

const deleteCoupon = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.user.restaurantId, req.params.id);
  ok(res, { deleted: true });
});

// Public: lets the customer check a coupon code + see the discount it would
// give *before* placing the order. The order itself re-validates
// server-side too — this endpoint is a convenience preview, not the source
// of truth.
const validatePublicCoupon = asyncHandler(async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new ApiError(404, "Restaurant not found");
  const { discountAmount, coupon } = await couponService.validateCoupon(
    restaurant.id,
    req.body.code,
    req.body.subtotal
  );
  ok(res, { code: coupon.code, discountAmount });
});

module.exports = { listCoupons, createCoupon, updateCoupon, deleteCoupon, validatePublicCoupon };
