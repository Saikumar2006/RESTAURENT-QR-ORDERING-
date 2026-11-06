const prisma = require("../config/db");
const env = require("../config/env");
const { ApiError } = require("../utils/http");
const twilioService = require("./twilioService");
const whatsappService = require("./whatsappService");

/**
 * RESTAURANT / TENANT OPERATIONS
 */
async function getRestaurantDetail(id) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, isActive: true, phone: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { payments: { orderBy: { createdAt: "desc" }, take: 3 } },
      },
      _count: {
        select: { tables: true, menuItems: true, categories: true, orders: true, coupons: true, supportTickets: true },
      },
    },
  });

  if (!restaurant) throw new ApiError(404, "Restaurant not found");

  const revenueAgg = await prisma.order.aggregate({
    where: { restaurantId: id, paymentStatus: "PAID" },
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  const recentOrders = await prisma.order.findMany({
    where: { restaurantId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, orderNumber: true, totalAmount: true, status: true, paymentStatus: true, createdAt: true, source: true },
  });

  return {
    ...restaurant,
    metrics: {
      totalRevenue: revenueAgg._sum.totalAmount || 0,
      paidOrdersCount: revenueAgg._count.id || 0,
    },
    recentOrders,
  };
}

async function updateRestaurantStatus(restaurantId, status, reason = "", adminId = null, db = prisma) {
  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    throw new ApiError(400, "Status must be ACTIVE or SUSPENDED");
  }

  const resolvedAdminId = typeof adminId === "object" ? adminId?.id : adminId;
  const existing = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!existing) throw new ApiError(404, "Restaurant not found");

  const updated = await db.restaurant.update({
    where: { id: restaurantId },
    data: { status },
  });

  try {
    await db.platformAdminAuditLog.create({
      data: {
        actorAdminId: resolvedAdminId,
        targetRestaurantId: restaurantId,
        action: status === "ACTIVE" ? "restaurant.reactivated" : "restaurant.suspended",
        metadata: JSON.stringify({ previousStatus: existing.status, newStatus: status, reason }),
      },
    });
  } catch {
    // Non-blocking audit record
  }

  return updated;
}

/**
 * CROSS-TENANT USER OPERATIONS
 */
async function listCrossTenantUsers({ search = "", role = "ALL", restaurantId = null, limit = 50, page = 1 }) {
  const take = Math.max(1, Math.min(Number(limit) || 50, 100));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const where = {};
  if (restaurantId) where.restaurantId = restaurantId;
  if (role !== "ALL") where.role = role;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      isActive: u.isActive,
      restaurantId: u.restaurantId,
      restaurantName: u.restaurant?.name,
      restaurantSlug: u.restaurant?.slug,
      restaurantStatus: u.restaurant?.status,
      createdAt: u.createdAt,
    })),
    pagination: {
      total,
      page: Number(page) || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
}

async function toggleTenantUserStatus(userId, isActive, adminId = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { restaurant: { select: { id: true, name: true } } },
  });
  if (!user) throw new ApiError(404, "User not found");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: Boolean(isActive) },
  });

  try {
    await prisma.platformAdminAuditLog.create({
      data: {
        actorAdminId: adminId,
        targetRestaurantId: user.restaurantId,
        action: isActive ? "user.reactivated" : "user.disabled",
        metadata: JSON.stringify({ userId, userEmail: user.email, previousStatus: user.isActive }),
      },
    });
  } catch {
    // Non-blocking
  }

  return updated;
}

/**
 * BILLING & TRANSACTIONS
 */
async function listTransactions({ limit = 50, page = 1, status = "ALL" }) {
  const take = Math.max(1, Math.min(Number(limit) || 50, 100));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const where = {};
  if (status !== "ALL") where.status = status;

  const [total, payments] = await Promise.all([
    prisma.subscriptionPayment.count({ where }),
    prisma.subscriptionPayment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: {
          include: {
            restaurant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
  ]);

  return {
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      billingPeriod: p.billingPeriod,
      providerPaymentId: p.providerPaymentId ? `${p.providerPaymentId.slice(0, 6)}••••${p.providerPaymentId.slice(-4)}` : null,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      restaurantName: p.subscription?.restaurant?.name || "Unknown",
      restaurantSlug: p.subscription?.restaurant?.slug,
      planKey: p.subscription?.planKey || "UNKNOWN",
    })),
    pagination: {
      total,
      page: Number(page) || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
}

/**
 * SUPPORT TICKETS
 */
async function listSupportTickets({ status = "ALL", priority = "ALL", limit = 50, page = 1 }) {
  const take = Math.max(1, Math.min(Number(limit) || 50, 100));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const where = {};
  if (status !== "ALL") where.status = status;
  if (priority !== "ALL") where.priority = priority;

  const [total, tickets] = await Promise.all([
    prisma.platformSupportTicket.count({ where }),
    prisma.platformSupportTicket.findMany({
      where,
      skip,
      take,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        restaurant: { select: { id: true, name: true, slug: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    tickets,
    pagination: {
      total,
      page: Number(page) || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
}

async function createSupportTicket(data, actorAdminId = null, db = prisma) {
  const { restaurantId, title, description, priority = "MEDIUM", category = "GENERAL", contactEmail, contactPhone, internalNotes = "" } = data;
  if (!title || title.trim().length < 3) throw new ApiError(400, "Title is required (minimum 3 characters).");
  if (!description || description.trim().length < 5) throw new ApiError(400, "Description is required (minimum 5 characters).");

  const resolvedAdminId = typeof actorAdminId === "object" ? actorAdminId?.id : actorAdminId;
  const ticketCount = await db.platformSupportTicket.count();
  const ticketNumber = `TICK-${String(ticketCount + 1).padStart(6, "0")}`;

  const ticket = await db.platformSupportTicket.create({
    data: {
      ticketNumber,
      restaurantId: restaurantId || null,
      title: title.trim(),
      description: description.trim(),
      status: "OPEN",
      priority,
      category,
      contactEmail: contactEmail?.trim() || null,
      contactPhone: contactPhone?.trim() || null,
      internalNotes: internalNotes.trim(),
      assignedAdminId: resolvedAdminId || null,
    },
    include: {
      restaurant: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true } },
    },
  });

  return ticket;
}

async function updateSupportTicket(ticketId, data, actorAdminId = null, db = prisma) {
  const existing = await db.platformSupportTicket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new ApiError(404, "Support ticket not found.");

  const resolvedAdminId = typeof actorAdminId === "object" ? actorAdminId?.id : actorAdminId;
  const updatePayload = {};
  if (data.status) updatePayload.status = data.status;
  if (data.priority) updatePayload.priority = data.priority;
  if (data.internalNotes !== undefined) updatePayload.internalNotes = data.internalNotes;
  if (data.assignedAdminId !== undefined) updatePayload.assignedAdminId = data.assignedAdminId;

  const updated = await db.platformSupportTicket.update({
    where: { id: ticketId },
    data: updatePayload,
    include: {
      restaurant: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true } },
    },
  });

  try {
    await db.platformAdminAuditLog.create({
      data: {
        actorAdminId: resolvedAdminId,
        targetRestaurantId: existing.restaurantId,
        action: "support_ticket.updated",
        metadata: JSON.stringify({ ticketId, changes: data }),
      },
    });
  } catch {
    // Non-blocking
  }

  return updated;
}

/**
 * SYSTEM HEALTH & INTEGRATIONS
 */
async function getSystemHealth() {
  const now = Date.now();
  let dbLatencyMs = -1;
  let dbStatus = "DISCONNECTED";

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbStatus = "HEALTHY";
  } catch (err) {
    dbStatus = "ERROR";
  }

  const twilioStatus = twilioService.getConnectionStatus();
  const metaStatus = whatsappService.getConnectionStatus();

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.nodeEnv,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      provider: "PostgreSQL",
    },
    services: {
      api: { status: "HEALTHY", version: "1.0.0" },
      redis: { configured: Boolean(process.env.REDIS_URL), status: process.env.REDIS_URL ? "CONFIGURED" : "DISABLED" },
      twilioSms: {
        status: twilioStatus.smsConfigured ? "READY" : "UNCONFIGURED",
        sender: twilioStatus.smsSender,
      },
      twilioWhatsapp: {
        status: twilioStatus.whatsappConfigured ? "READY" : "UNCONFIGURED",
        sender: twilioStatus.whatsappSender,
      },
      metaWhatsapp: {
        status: metaStatus.ready ? "READY" : "UNCONFIGURED",
        verified: metaStatus.ready,
      },
      paymentGateway: {
        provider: env.paymentProvider,
        keyConfigured: Boolean(env.razorpayKeyId),
      },
      oauth: {
        provider: "Google OAuth 2.0",
        configured: Boolean(env.googleClientId && env.googleClientSecret),
        callback: env.googleCallbackUrl,
      },
    },
    memory: {
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
}

/**
 * PLATFORM SETTINGS
 */
async function getPlatformSettings() {
  const settings = await prisma.platformSetting.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  const defaults = {
    PLATFORM_NAME: "Svaadya",
    SUPPORT_EMAIL: "svaadyarestro@gmail.com",
    DEFAULT_CURRENCY: "INR",
    DEFAULT_TIMEZONE: "Asia/Kolkata",
    DEFAULT_TRIAL_DAYS: "14",
    MAINTENANCE_MODE: "false",
    ALLOW_PUBLIC_REGISTRATION: "true",
  };

  const map = { ...defaults };
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return { settings, map };
}

async function updatePlatformSetting(key, value, category = "GENERAL", description = "", adminId = null) {
  if (!key || typeof key !== "string") throw new ApiError(400, "Setting key is required.");

  const setting = await prisma.platformSetting.upsert({
    where: { key: key.trim().toUpperCase() },
    update: {
      value: String(value),
      category,
      description: description || undefined,
      updatedBy: adminId,
    },
    create: {
      key: key.trim().toUpperCase(),
      value: String(value),
      category,
      description,
      updatedBy: adminId,
    },
  });

  try {
    await prisma.platformAdminAuditLog.create({
      data: {
        actorAdminId: adminId,
        action: "platform_setting.updated",
        metadata: JSON.stringify({ key, value }),
      },
    });
  } catch {
    // Non-blocking
  }

  return setting;
}

/**
 * ONBOARDING FUNNEL & ASSISTANCE
 */
async function getOnboardingFunnel() {
  const restaurants = await prisma.restaurant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: {
        select: { users: true, categories: true, menuItems: true, tables: true, orders: true, subscriptions: true },
      },
      users: { select: { email: true, isActive: true }, take: 1 },
      subscriptions: { select: { status: true, planKey: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const funnelList = restaurants.map((r) => {
    const hasOwner = r._count.users > 0;
    const hasMenu = r._count.categories > 0 && r._count.menuItems > 0;
    const hasTables = r._count.tables > 0;
    const hasSubscription = r._count.subscriptions > 0;
    const hasFirstOrder = r._count.orders > 0;

    const stepsCompleted = [hasOwner, true, hasMenu, hasTables, hasSubscription, hasFirstOrder].filter(Boolean).length;
    const progressPercent = Math.round((stepsCompleted / 6) * 100);

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.createdAt,
      ownerEmail: r.users[0]?.email || "Not set",
      steps: {
        accountCreated: true,
        ownerActivated: hasOwner,
        menuConfigured: hasMenu,
        tablesAndQrGenerated: hasTables,
        subscriptionActive: hasSubscription,
        firstOrderReceived: hasFirstOrder,
      },
      progressPercent,
      plan: r.subscriptions[0]?.planKey || "None",
    };
  });

  return funnelList;
}

module.exports = {
  getRestaurantDetail,
  updateRestaurantStatus,
  listCrossTenantUsers,
  toggleTenantUserStatus,
  listTransactions,
  listSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  getSystemHealth,
  getPlatformSettings,
  updatePlatformSetting,
  getOnboardingFunnel,
};
