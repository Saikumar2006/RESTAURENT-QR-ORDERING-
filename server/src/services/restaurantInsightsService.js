const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { getDateKeyInTimezone, getHourInTimezone, getZonedDayBounds, isValidTimeZone, nextCalendarDate, startOfZonedDay } = require("../utils/timezone");

async function getTodayOperations(restaurantId, now = new Date(), database = prisma) {
  const restaurant = await database.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  if (!restaurant) throw new ApiError(404, "Restaurant not found");

  const timeZone = restaurant.timezone || "Asia/Kolkata";
  const { dateKey, start, end } = getZonedDayBounds(now, timeZone);
  const where = { restaurantId, createdAt: { gte: start, lt: end } };
  const [orderCount, paidTotals, recentOrders] = await Promise.all([
    database.order.count({ where }),
    database.order.aggregate({ where: { ...where, paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    database.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { id: true } },
        table: { select: { tableNumber: true } },
      },
    }),
  ]);

  return { businessDate: dateKey, timeZone, summary: { orderCount, paidRevenue: Number(paidTotals._sum.totalAmount || 0) }, recentOrders };
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getAnalytics(restaurantId, rawDays = 7, range = {}, database = prisma, now = new Date()) {
  const restaurant = await database.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  if (!restaurant) throw new ApiError(404, "Restaurant not found");
  const timeZone = restaurant.timezone || "Asia/Kolkata";
  if (!isValidTimeZone(timeZone)) throw new ApiError(409, "Restaurant time zone is invalid; update it in settings");

  let days = Math.min(90, Math.max(1, Number.parseInt(rawDays, 10) || 7));
  const todayKey = getDateKeyInTimezone(now, timeZone);
  let fromKey;
  let toKey;
  if (range.from || range.to) {
    if (!isDateKey(range.from) || !isDateKey(range.to) || range.from > range.to || range.to > todayKey) {
      throw new ApiError(400, "Choose a valid date range ending no later than today");
    }
    fromKey = range.from;
    toKey = range.to;
    days = (Date.parse(`${toKey}T00:00:00.000Z`) - Date.parse(`${fromKey}T00:00:00.000Z`)) / 86_400_000 + 1;
    if (days > 90) throw new ApiError(400, "Date range cannot exceed 90 days");
  } else {
    toKey = todayKey;
    fromKey = shiftDateKey(toKey, -days + 1);
  }
  const start = startOfZonedDay(fromKey, timeZone);
  const end = startOfZonedDay(nextCalendarDate(toKey), timeZone);

  const orders = await database.order.findMany({
    where: { restaurantId, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { menuItem: { include: { category: true } } } } },
  });

  const daily = Array.from({ length: days }, (_, index) => {
    return { date: shiftDateKey(fromKey, index), orders: 0, revenue: 0 };
  });
  const dailyMap = new Map(daily.map((entry) => [entry.date, entry]));
  const itemMap = new Map();
  const categoryMap = new Map();
  const couponMap = new Map();
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));

  let paidOrderCount = 0;
  let paidRevenue = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let activeCount = 0;

  for (const order of orders) {
    const day = dailyMap.get(getDateKeyInTimezone(order.createdAt, timeZone));
    if (day) {
      day.orders += 1;
      if (order.paymentStatus === "PAID") day.revenue += Number(order.totalAmount);
    }
    peakHours[getHourInTimezone(order.createdAt, timeZone)].orders += 1;
    if (order.paymentStatus === "PAID") {
      paidOrderCount += 1;
      paidRevenue += Number(order.totalAmount);
    }
    if (order.status === "COMPLETED") completedCount += 1;
    if (order.status === "CANCELLED") cancelledCount += 1;
    if (!["COMPLETED", "CANCELLED"].includes(order.status)) activeCount += 1;

    if (order.couponCode) {
      const coupon = couponMap.get(order.couponCode) || { code: order.couponCode, redemptions: 0, discount: 0 };
      coupon.redemptions += 1;
      coupon.discount += Number(order.discountAmount);
      couponMap.set(order.couponCode, coupon);
    }

    for (const item of order.items) {
      const current = itemMap.get(item.menuItemId) || { id: item.menuItemId, name: item.itemName, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += Number(item.lineTotal);
      itemMap.set(item.menuItemId, current);

      const categoryName = item.menuItem?.category?.name;
      if (categoryName) {
        const category = categoryMap.get(categoryName) || { name: categoryName, quantity: 0, revenue: 0 };
        category.quantity += item.quantity;
        category.revenue += Number(item.lineTotal);
        categoryMap.set(categoryName, category);
      }
    }
  }

  return {
    days,
    summary: {
      orderCount: orders.length,
      paidOrderCount,
      paidRevenue,
      averagePaidOrderValue: paidOrderCount ? paidRevenue / paidOrderCount : 0,
      completedCount,
      cancelledCount,
      activeCount,
      couponRedemptions: [...couponMap.values()].reduce((sum, coupon) => sum + coupon.redemptions, 0),
    },
    daily,
    topItems: [...itemMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
    categories: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
    coupons: [...couponMap.values()].sort((a, b) => b.redemptions - a.redemptions),
    peakHours,
  };
}

async function getCustomers(restaurantId) {
  const orders = await prisma.order.findMany({
    where: { restaurantId, customerPhone: { not: null }, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: {
      customerName: true,
      customerPhone: true,
      orderNumber: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
      items: { select: { itemName: true, quantity: true } },
    },
  });

  const customersByPhone = new Map();
  for (const order of orders) {
    const phone = order.customerPhone.trim();
    if (!phone) continue;
    const customer = customersByPhone.get(phone) || {
      phone,
      name: order.customerName || null,
      orderCount: 0,
      totalSpent: 0,
      firstOrderAt: order.createdAt,
      lastOrderAt: order.createdAt,
      favoriteItems: new Map(),
    };
    customer.orderCount += 1;
    if (!customer.name && order.customerName) customer.name = order.customerName;
    if (order.paymentStatus === "PAID") customer.totalSpent += Number(order.totalAmount);
    if (order.createdAt < customer.firstOrderAt) customer.firstOrderAt = order.createdAt;
    if (order.createdAt > customer.lastOrderAt) customer.lastOrderAt = order.createdAt;
    for (const item of order.items) {
      customer.favoriteItems.set(item.itemName, (customer.favoriteItems.get(item.itemName) || 0) + item.quantity);
    }
    customersByPhone.set(phone, customer);
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const customers = [...customersByPhone.values()].map((customer) => ({
    phone: customer.phone,
    name: customer.name,
    orderCount: customer.orderCount,
    totalSpent: customer.totalSpent,
    firstOrderAt: customer.firstOrderAt,
    lastOrderAt: customer.lastOrderAt,
    isNew: customer.firstOrderAt >= monthStart,
    favoriteItems: [...customer.favoriteItems.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, quantity]) => ({ name, quantity })),
  })).sort((a, b) => b.lastOrderAt - a.lastOrderAt);

  const returningCount = customers.filter((customer) => customer.orderCount > 1).length;
  const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
  return {
    summary: {
      totalCustomers: customers.length,
      newCustomers: customers.filter((customer) => customer.isNew).length,
      returningCustomers: returningCount,
      averageCustomerSpend: customers.length ? totalSpent / customers.length : 0,
    },
    customers,
  };
}

module.exports = { getAnalytics, getCustomers, getTodayOperations };
