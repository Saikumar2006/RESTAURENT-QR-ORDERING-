const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/config/db");
const couponService = require("../src/services/couponService");
const { couponCreateSchema, couponUpdateSchema } = require("../src/validators/schemas");

test("coupon validation rejects over-100 percent discounts and invalid caps", () => {
  const coupon = { code: "SAVE", type: "PERCENT", value: 10 };
  assert.equal(couponCreateSchema.safeParse({ ...coupon, value: 100 }).success, true);
  assert.equal(couponCreateSchema.safeParse({ ...coupon, value: 100.01 }).success, false);
  assert.equal(couponCreateSchema.safeParse({ ...coupon, type: "FLAT", maxDiscountAmount: 10 }).success, false);
  assert.equal(couponUpdateSchema.safeParse({ type: "PERCENT", value: 101 }).success, false);
});

test("coupon usage claims use an atomic compare-and-increment at the configured limit", async () => {
  const originalFindUnique = prisma.coupon.findUnique;
  const originalUpdateMany = prisma.coupon.updateMany;
  const coupon = { usageCount: 0, usageLimit: 1, isActive: true, expiresAt: null };
  prisma.coupon.findUnique = async () => ({ ...coupon });
  prisma.coupon.updateMany = async ({ where, data }) => {
    if (coupon.usageCount >= where.usageCount.lt || coupon.usageLimit !== where.usageLimit || !coupon.isActive) return { count: 0 };
    coupon.usageCount += data.usageCount.increment;
    return { count: 1 };
  };

  try {
    const results = await Promise.allSettled([
      couponService.incrementUsage("coupon-a"),
      couponService.incrementUsage("coupon-a"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(coupon.usageCount, 1);
  } finally {
    prisma.coupon.findUnique = originalFindUnique;
    prisma.coupon.updateMany = originalUpdateMany;
  }
});
