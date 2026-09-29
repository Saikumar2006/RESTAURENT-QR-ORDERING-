const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { round2 } = require("../utils/order");

async function listCoupons(restaurantId) {
  return prisma.coupon.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" } });
}

async function createCoupon(restaurantId, data) {
  const code = data.code.toUpperCase();
  const existing = await prisma.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code } } });
  if (existing) throw new ApiError(409, "A coupon with this code already exists");
  return prisma.coupon.create({ data: { ...data, code, restaurantId } });
}

async function updateCoupon(restaurantId, couponId, data) {
  const coupon = await prisma.coupon.findFirst({ where: { id: couponId, restaurantId } });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  const patch = { ...data };
  if (patch.code) patch.code = patch.code.toUpperCase();
  return prisma.coupon.update({ where: { id: couponId }, data: patch });
}

async function deleteCoupon(restaurantId, couponId) {
  const coupon = await prisma.coupon.findFirst({ where: { id: couponId, restaurantId } });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  // Coupons aren't referenced by a foreign key from orders (orders only
  // snapshot the code as a string), so a hard delete is safe here.
  return prisma.coupon.delete({ where: { id: couponId } });
}

// Checks a coupon code against a restaurant + cart subtotal and returns the
// discount it would produce. Throws ApiError(400, ...) with a customer-facing
// message for anything invalid, so callers (order creation, the cart's
// "Apply" button) can surface it directly.
async function validateCoupon(restaurantId, rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw new ApiError(400, "Enter a coupon code");

  const coupon = await prisma.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code } } });
  if (!coupon || !coupon.isActive) throw new ApiError(400, "This coupon code isn't valid");
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    throw new ApiError(400, "This coupon has expired");
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    throw new ApiError(400, "This coupon has already been fully redeemed");
  }
  if (subtotal < coupon.minOrderAmount) {
    throw new ApiError(400, `This coupon needs a minimum order of ₹${coupon.minOrderAmount}`);
  }

  let discountAmount =
    coupon.type === "PERCENT" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscountAmount != null) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  discountAmount = round2(Math.min(discountAmount, subtotal));

  return { coupon, discountAmount };
}

async function incrementUsage(couponId) {
  return prisma.coupon.update({ where: { id: couponId }, data: { usageCount: { increment: 1 } } });
}

module.exports = { listCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, incrementUsage };
