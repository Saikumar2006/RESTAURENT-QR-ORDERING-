const prisma = require("../config/db");
const { isRestaurantOpenNow } = require("../utils/restaurantStatus");

function monthlySeries(rows, now, fieldName) {
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const counts = new Map();
  for (const row of rows) {
    const date = row.createdAt;
    if (!(date instanceof Date) || date < firstMonth) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      month: date.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      [fieldName]: counts.get(key) || 0,
    };
  });
}

async function getOverview(database = prisma, now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const activeSubscriptionWhere = {
    status: "ACTIVE",
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
  const trialSubscriptionWhere = {
    status: "TRIALING",
    OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
  };
  const [
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants,
    totalUsers,
    usersByRole,
    totalOrders,
    ordersToday,
    revenueAgg,
    revenueTodayAgg,
    restaurants,
    restaurantRegistrationRows,
    cuisineGroups,
    totalPlatformUsers,
    pendingOnboardings,
    activeSubscriptions,
    trialingSubscriptions,
    monthlyRevenueGroups,
    planGroups,
    subscriptionRegistrationRows,
    subscriptionRevenueAgg,
    subscriptionRevenueMonthAgg,
  ] = await Promise.all([
    database.restaurant.count(),
    database.restaurant.count({ where: { status: "ACTIVE" } }),
    database.restaurant.count({ where: { status: "SUSPENDED" } }),
    database.user.count(),
    database.user.groupBy({ by: ["role"], _count: { role: true } }),
    database.order.count(),
    database.order.count({ where: { createdAt: { gte: startOfToday } } }),
    database.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    database.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: startOfToday } },
      _sum: { totalAmount: true },
    }),
    database.restaurant.findMany({
      select: { isOpen: true, autoScheduleEnabled: true, openTime: true, closeTime: true, timezone: true },
    }),
    database.restaurant.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    database.restaurant.groupBy({ by: ["cuisineType"], _count: { cuisineType: true } }),
    database.platformAdmin.count(),
    database.pendingOnboarding.count({ where: { status: "PENDING_PAYMENT" } }),
    database.subscription.count({ where: activeSubscriptionWhere }),
    database.subscription.count({ where: trialSubscriptionWhere }),
    database.subscription.groupBy({
      by: ["billingPeriod"],
      where: activeSubscriptionWhere,
      _sum: { amount: true },
    }),
    database.subscription.groupBy({
      by: ["planKey"],
      where: { OR: [activeSubscriptionWhere, trialSubscriptionWhere] },
      _count: { planKey: true },
    }),
    database.subscription.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    database.subscriptionPayment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    database.subscriptionPayment.aggregate({
      where: { status: "PAID", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  const openNowCount = restaurants.filter((r) => isRestaurantOpenNow(r)).length;

  const usersByRoleMap = { ADMIN: 0, STAFF: 0 };
  usersByRole.forEach((g) => {
    usersByRoleMap[g.role] = g._count.role;
  });

  const restaurantsByCuisine = cuisineGroups
    .map((g) => ({ cuisineType: g.cuisineType || "Unspecified", count: g._count.cuisineType }))
    .sort((a, b) => b.count - a.count);
  const monthlyRecurringRevenue = monthlyRevenueGroups.reduce((total, group) => {
    const amount = group._sum.amount || 0;
    const period = String(group.billingPeriod || "").toUpperCase();
    const divisor = period === "YEARLY" ? 12 : period === "6_MONTHS" ? 6 : period === "3_MONTHS" ? 3 : 1;
    return total + amount / divisor;
  }, 0);
  const restaurantRegistrations = monthlySeries(restaurantRegistrationRows, now, "count");
  const subscriptionRegistrations = monthlySeries(subscriptionRegistrationRows, now, "count");

  return {
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants,
    openNowCount,
    closedNowCount: totalRestaurants - openNowCount,
    totalUsers,
    usersByRole: usersByRoleMap,
    totalOrders,
    ordersToday,
    totalRevenue: revenueAgg._sum.totalAmount || 0,
    revenueToday: revenueTodayAgg._sum.totalAmount || 0,
    restaurantsByCuisine,
    totalPlatformUsers,
    pendingOnboardings,
    activeSubscriptions,
    trialingSubscriptions,
    monthlyRecurringRevenue,
    subscriptionRevenue: subscriptionRevenueAgg._sum.amount || 0,
    subscriptionRevenueMonth: subscriptionRevenueMonthAgg._sum.amount || 0,
    planDistribution: planGroups.map((group) => ({ planKey: group.planKey, count: group._count.planKey })),
    restaurantRegistrations,
    subscriptionRegistrations,
  };
}

async function listRestaurants() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, tables: true, menuItems: true, orders: true } },
      users: { where: { role: "ADMIN" }, select: { isActive: true }, take: 1 },
      platformInvites: { where: { consumedAt: null }, select: { id: true }, take: 1 },
    },
  });

  // One query per restaurant for paid revenue is avoided by batching via
  // groupBy instead of N+1'ing prisma.order.aggregate per restaurant.
  const revenueByRestaurant = await prisma.order.groupBy({
    by: ["restaurantId"],
    where: { paymentStatus: "PAID" },
    _sum: { totalAmount: true },
  });
  const revenueMap = new Map(revenueByRestaurant.map((r) => [r.restaurantId, r._sum.totalAmount || 0]));

  return restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    ownerSetupPending: r.users.some((user) => !user.isActive) && r.platformInvites.length > 0,
    cuisineType: r.cuisineType,
    isOpenNow: isRestaurantOpenNow(r),
    geofenceEnabled: r.geofenceEnabled,
    createdAt: r.createdAt,
    staffCount: r._count.users,
    tableCount: r._count.tables,
    menuItemCount: r._count.menuItems,
    orderCount: r._count.orders,
    totalRevenue: revenueMap.get(r.id) || 0,
  }));
}

module.exports = { getOverview, listRestaurants };
