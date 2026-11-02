const test = require("node:test");
const assert = require("node:assert/strict");
const { getOverview } = require("../src/services/platformService");

test("platform overview derives recurring revenue, plan mix, and monthly trends from persisted records", async () => {
  const now = new Date("2026-11-02T12:00:00.000Z");
  const database = {
    restaurant: {
      count: async ({ where } = {}) => where?.status === "ACTIVE" ? 6 : where?.status === "SUSPENDED" ? 2 : 8,
      findMany: async ({ select }) => "createdAt" in select
        ? [{ createdAt: new Date("2026-11-01T00:00:00.000Z") }]
        : [],
      groupBy: async () => [{ cuisineType: "Cafe", _count: { cuisineType: 3 } }],
    },
    user: {
      count: async () => 10,
      groupBy: async () => [{ role: "ADMIN", _count: { role: 4 } }, { role: "STAFF", _count: { role: 6 } }],
    },
    order: {
      count: async () => 20,
      aggregate: async () => ({ _sum: { totalAmount: 1250 } }),
    },
    platformAdmin: { count: async () => 3 },
    pendingOnboarding: { count: async () => 2 },
    subscription: {
      count: async ({ where }) => where.status === "ACTIVE" ? 2 : 1,
      groupBy: async ({ by }) => by[0] === "billingPeriod"
        ? [
          { billingPeriod: "MONTHLY", _sum: { amount: 1500 } },
          { billingPeriod: "YEARLY", _sum: { amount: 12000 } },
        ]
        : [{ planKey: "GROWTH", _count: { planKey: 2 } }],
      findMany: async () => [{ createdAt: new Date("2026-11-01T00:00:00.000Z") }],
    },
    subscriptionPayment: {
      aggregate: async () => ({ _sum: { amount: 8400 } }),
    },
  };

  const overview = await getOverview(database, now);

  assert.equal(overview.totalRestaurants, 8);
  assert.equal(overview.activeRestaurants, 6);
  assert.equal(overview.suspendedRestaurants, 2);
  assert.equal(overview.activeSubscriptions, 2);
  assert.equal(overview.trialingSubscriptions, 1);
  assert.equal(overview.monthlyRecurringRevenue, 2500);
  assert.equal(overview.subscriptionRevenue, 8400);
  assert.deepEqual(overview.planDistribution, [{ planKey: "GROWTH", count: 2 }]);
  assert.equal(overview.restaurantRegistrations.at(-1).count, 1);
  assert.equal(overview.subscriptionRegistrations.at(-1).count, 1);
});
