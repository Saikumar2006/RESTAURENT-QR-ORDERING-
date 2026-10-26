const test = require("node:test");
const assert = require("node:assert/strict");
const { getDateKeyInTimezone, getZonedDayBounds } = require("../src/utils/timezone");
const { getAnalytics, getTodayOperations } = require("../src/services/restaurantInsightsService");
const { restaurantUpdateSchema } = require("../src/validators/schemas");

test("zoned business-day bounds follow daylight-saving transitions", () => {
  const springForward = getZonedDayBounds(new Date("2026-03-08T16:00:00.000Z"), "America/New_York");
  assert.equal(springForward.dateKey, "2026-03-08");
  assert.equal(springForward.start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(springForward.end.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal((springForward.end - springForward.start) / 3_600_000, 23);

  const fallBack = getZonedDayBounds(new Date("2026-11-01T16:00:00.000Z"), "America/New_York");
  assert.equal((fallBack.end - fallBack.start) / 3_600_000, 25);
  assert.equal(getDateKeyInTimezone(new Date("2026-01-01T18:45:00.000Z"), "Asia/Kolkata"), "2026-01-02");
});

test("today operations query only the tenant's local business day and return five recent orders", async () => {
  const calls = [];
  const database = {
    restaurant: { async findUnique(query) { calls.push(["restaurant", query]); return { timezone: "Asia/Kolkata" }; } },
    order: {
      async count(query) { calls.push(["count", query]); return 8; },
      async aggregate(query) { calls.push(["aggregate", query]); return { _sum: { totalAmount: 725.5 } }; },
      async findMany(query) { calls.push(["findMany", query]); return [{ id: "o5" }, { id: "o4" }, { id: "o3" }, { id: "o2" }, { id: "o1" }]; },
    },
  };

  const result = await getTodayOperations("restaurant-a", new Date("2026-01-02T06:00:00.000Z"), database);
  assert.equal(result.businessDate, "2026-01-02");
  assert.equal(result.timeZone, "Asia/Kolkata");
  assert.deepEqual(result.summary, { orderCount: 8, paidRevenue: 725.5 });
  assert.equal(result.recentOrders.length, 5);
  assert.equal(calls[1][1].where.restaurantId, "restaurant-a");
  assert.equal(calls[1][1].where.createdAt.gte.toISOString(), "2026-01-01T18:30:00.000Z");
  assert.equal(calls[1][1].where.createdAt.lt.toISOString(), "2026-01-02T18:30:00.000Z");
  assert.deepEqual(calls[3][1].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(calls[3][1].take, 5);
  assert.equal(calls[3][1].select.customerPhone, undefined);
  assert.equal(calls[3][1].select.orderSessionToken, undefined);
});

test("analytics range uses tenant timezone boundaries and groups orders by local date", async () => {
  let query;
  const database = {
    restaurant: { async findUnique() { return { timezone: "America/New_York" }; } },
    order: { async findMany(args) {
      query = args;
      return [
        { createdAt: new Date("2026-03-08T05:30:00.000Z"), paymentStatus: "PAID", totalAmount: 25, status: "COMPLETED", couponCode: null, discountAmount: 0, items: [] },
        { createdAt: new Date("2026-03-09T03:30:00.000Z"), paymentStatus: "PAID", totalAmount: 10, status: "PENDING", couponCode: null, discountAmount: 0, items: [] },
      ];
    } },
  };

  const result = await getAnalytics("restaurant-a", 7, { from: "2026-03-08", to: "2026-03-08" }, database, new Date("2026-03-09T12:00:00.000Z"));
  assert.equal(query.where.restaurantId, "restaurant-a");
  assert.equal(query.where.createdAt.gte.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(query.where.createdAt.lt.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.deepEqual(result.daily, [{ date: "2026-03-08", orders: 2, revenue: 35 }]);
  assert.equal(result.peakHours[0].orders, 1);
  assert.equal(result.peakHours[23].orders, 1);
});

test("analytics rejects invalid, future, reversed, and over-90-day ranges", async () => {
  const database = { restaurant: { async findUnique() { return { timezone: "Asia/Kolkata" }; } } };
  const now = new Date("2026-10-26T12:00:00.000Z");
  for (const range of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-27", to: "2026-10-27" },
    { from: "2026-03-02", to: "2026-03-01" },
    { from: "2026-01-01", to: "2026-04-01" },
  ]) {
    await assert.rejects(getAnalytics("restaurant-a", 7, range, database, now), { status: 400 });
  }
});

test("restaurant timezone settings accept valid IANA zones and reject invalid values", () => {
  assert.equal(restaurantUpdateSchema.safeParse({ timezone: "Asia/Kolkata" }).success, true);
  assert.equal(restaurantUpdateSchema.safeParse({ timezone: "Not/A_Real_Zone" }).success, false);
});
