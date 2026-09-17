const prisma = require("../config/db");
const { isRestaurantOpenNow } = require("../utils/restaurantStatus");

async function getOverview() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalRestaurants,
    activeRestaurants,
    totalUsers,
    usersByRole,
    totalOrders,
    ordersToday,
    revenueAgg,
    revenueTodayAgg,
    restaurants,
    cuisineGroups,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: startOfToday } },
      _sum: { totalAmount: true },
    }),
    // Needed to compute "open right now" per restaurant (isOpen + schedule),
    // which isn't a single column — see restaurantStatus.js.
    prisma.restaurant.findMany({
      select: { isOpen: true, autoScheduleEnabled: true, openTime: true, closeTime: true, timezone: true },
    }),
    prisma.restaurant.groupBy({ by: ["cuisineType"], _count: { cuisineType: true } }),
  ]);

  const openNowCount = restaurants.filter((r) => isRestaurantOpenNow(r)).length;

  const usersByRoleMap = { ADMIN: 0, STAFF: 0 };
  usersByRole.forEach((g) => {
    usersByRoleMap[g.role] = g._count.role;
  });

  const restaurantsByCuisine = cuisineGroups
    .map((g) => ({ cuisineType: g.cuisineType || "Unspecified", count: g._count.cuisineType }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants: totalRestaurants - activeRestaurants,
    openNowCount,
    closedNowCount: totalRestaurants - openNowCount,
    totalUsers,
    usersByRole: usersByRoleMap,
    totalOrders,
    ordersToday,
    totalRevenue: revenueAgg._sum.totalAmount || 0,
    revenueToday: revenueTodayAgg._sum.totalAmount || 0,
    restaurantsByCuisine,
  };
}

async function listRestaurants() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, tables: true, menuItems: true, orders: true } },
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
