const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { round2 } = require("../utils/order");

async function listCoupons(restaurantId) {
  return prisma.coupon.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" } });
}

async function createCoupon(restaurantId, data) {
  const code = data.code.trim().toUpperCase();
  const existing = await prisma.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code } } });
  if (existing) throw new ApiError(409, "A coupon with this code already exists");
  try {
    return await prisma.coupon.create({ data: { ...data, code, restaurantId } });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A coupon with this code already exists");
    throw error;
  }
}

async function updateCoupon(restaurantId, couponId, data) {
  const coupon = await prisma.coupon.findFirst({ where: { id: couponId, restaurantId } });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  const patch = { ...data };
  if (patch.code) patch.code = patch.code.trim().toUpperCase();
  const nextType = patch.type ?? coupon.type;
  const nextValue = patch.value ?? coupon.value;
  const nextCap = Object.hasOwn(patch, "maxDiscountAmount") ? patch.maxDiscountAmount : coupon.maxDiscountAmount;
  if (nextType === "PERCENT" && Number(nextValue) > 100) throw new ApiError(400, "Percentage discount cannot exceed 100%");
  if (nextType === "FLAT" && nextCap != null) throw new ApiError(400, "A maximum discount cap only applies to percentage coupons");
  if (patch.usageLimit != null && patch.usageLimit < coupon.usageCount) {
    throw new ApiError(400, "Usage limit cannot be lower than coupons already redeemed");
  }
  try {
    return await prisma.coupon.update({ where: { id: couponId }, data: patch });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A coupon with this code already exists");
    throw error;
  }
}

async function deleteCoupon(restaurantId, couponId) {
  const coupon = await prisma.coupon.findFirst({ where: { id: couponId, restaurantId } });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  if (coupon.usageCount > 0) throw new ApiError(409, "A used coupon cannot be deleted; deactivate it to archive it");
  const deleted = await prisma.coupon.deleteMany({ where: { id: couponId, restaurantId, usageCount: 0 } });
  if (deleted.count !== 1) throw new ApiError(409, "Coupon usage changed; refresh and try again");
  return { id: couponId };
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

async function incrementUsage(couponId, database = prisma) {
  const current = await database.coupon.findUnique({
    where: { id: couponId },
    select: { usageCount: true, usageLimit: true, isActive: true, expiresAt: true },
  });
  if (!current || !current.isActive || (current.expiresAt && current.expiresAt < new Date())) {
    throw new ApiError(409, "This coupon is no longer available");
  }
  if (current.usageLimit != null && current.usageCount >= current.usageLimit) {
    throw new ApiError(409, "This coupon has already been fully redeemed");
  }

  const claimed = await database.coupon.updateMany({
    where: {
      id: couponId,
      isActive: true,
      usageLimit: current.usageLimit,
      expiresAt: current.expiresAt,
      ...(current.usageLimit != null ? { usageCount: { lt: current.usageLimit } } : {}),
    },
    data: { usageCount: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new ApiError(409, "Coupon availability changed; review your order and try again");
  return claimed;
}

module.exports = { listCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, incrementUsage };
