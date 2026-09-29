const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { generateOrderNumber, computeTotals, canTransition } = require("../utils/order");
const { resolveTableByToken, resolveRestaurantBySlug } = require("./tableService");
const couponService = require("./couponService");
const { emitNewOrder, emitOrderUpdated, emitOrderStatus } = require("../sockets");
const { isRestaurantOpenNow } = require("../utils/restaurantStatus");
const { isWithinGeofence } = require("../utils/geo");
const { verifyToken } = require("../utils/auth");
const messagingService = require("./messagingService");
const env = require("../config/env");

// Creates a customer order. Re-reads menu prices/availability from the
// database rather than trusting anything the client sent for pricing —
// only menuItemId + quantity + instructions are taken from the client.
//
// orderType decides how the restaurant/table are resolved:
//   DINE_IN  — tableToken (picked on the landing page) resolves both the
//              table AND the restaurant, exactly as the old per-table QR did.
//   TAKEAWAY — no table at all; the restaurant is resolved from its slug.
async function createOrder({
  slug,
  orderType,
  tableToken,
  items,
  customerName,
  customerPhone,
  phoneVerificationToken,
  couponCode,
  latitude,
  longitude,
}) {
  let restaurant;
  let table = null;

  if (orderType === "TAKEAWAY") {
    restaurant = await resolveRestaurantBySlug(slug);
  } else {
    table = await resolveTableByToken(tableToken);
    restaurant = table.restaurant;
    // Defense in depth: if a slug was also sent, make sure it agrees with
    // the table's own restaurant rather than trusting it blindly.
    if (slug && restaurant.slug !== slug) {
      throw new ApiError(400, "Table does not belong to this restaurant");
    }
  }

  // Backstop behind the client-side "Out of Service" screen and geofence
  // check on the landing page — the browser check can be skipped by anyone
  // calling the API directly, so both are re-verified here too.
  if (!isRestaurantOpenNow(restaurant)) {
    throw new ApiError(403, "This restaurant is currently closed and not accepting orders.");
  }
  if (restaurant.geofenceEnabled) {
    if (latitude == null || longitude == null) {
      throw new ApiError(403, "Location is required to place an order at this restaurant.");
    }
    const within = isWithinGeofence(restaurant, latitude, longitude);
    if (within === false) {
      throw new ApiError(403, "Orders can only be placed from inside the restaurant.");
    }
    // within === null means the restaurant enabled geofencing without
    // setting a location — fail closed rather than silently allow anyone.
    if (within === null) {
      throw new ApiError(500, "This restaurant's location isn't configured yet. Ask staff to set it in Admin > Settings.");
    }
  }

  if (restaurant.phoneVerificationEnabled) {
    if (!customerPhone) {
      throw new ApiError(400, "A phone number is required to place an order at this restaurant.");
    }
    if (!phoneVerificationToken) {
      throw new ApiError(403, "Please verify your phone number before placing an order.");
    }
    let payload;
    try {
      payload = verifyToken(phoneVerificationToken);
    } catch {
      throw new ApiError(403, "Phone verification expired. Please verify your number again.");
    }
    if (payload.type !== "phone_verify" || payload.phone !== customerPhone) {
      throw new ApiError(403, "Phone verification does not match. Please verify your number again.");
    }
  }

  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: restaurant.id },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const unavailable = [];
  const lineItems = items.map((i) => {
    const menuItem = menuItemMap.get(i.menuItemId);
    if (!menuItem || !menuItem.isAvailable) {
      unavailable.push(i.menuItemId);
      return null;
    }
    return {
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      unitPrice: Number(menuItem.price),
      quantity: i.quantity,
      instructions: i.instructions,
      lineTotal: Number(menuItem.price) * i.quantity,
    };
  });

  if (unavailable.length > 0) {
    throw new ApiError(409, "Some items in your cart are no longer available. Please review your cart.", {
      unavailableMenuItemIds: unavailable,
    });
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);

  // A coupon, if valid, takes priority over the restaurant's blanket
  // default discount — they don't stack. couponCode is re-validated here
  // (never trusting a discount amount the client might have sent).
  let discountAmount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const result = await couponService.validateCoupon(restaurant.id, couponCode, subtotal);
    appliedCoupon = result.coupon;
    discountAmount = result.discountAmount;
  } else if (restaurant.discountEnabled && restaurant.discountPercent > 0) {
    discountAmount = (subtotal * restaurant.discountPercent) / 100;
  }

  const totals = computeTotals({
    lineItems,
    taxPercent: restaurant.taxPercent,
    serviceChargePercent: restaurant.serviceChargePercent,
    discountAmount,
  });

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table ? table.id : null,
      orderType,
      orderNumber: generateOrderNumber(),
      status: "PENDING",
      paymentStatus: "PENDING",
      customerName,
      customerPhone,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      ...totals,
      items: { create: lineItems.map(({ menuItemId, itemName, unitPrice, quantity, instructions, lineTotal }) => ({
        menuItemId, itemName, unitPrice, quantity, instructions, lineTotal,
      })) },
    },
    include: { items: true, table: true },
  });

  // Only counts toward the coupon's usage limit once the order is actually
  // created — a failed order (e.g. an item went unavailable) shouldn't burn
  // a redemption.
  if (appliedCoupon) {
    await couponService.incrementUsage(appliedCoupon.id);
  }

  emitNewOrder(restaurant.id, orderSummary(order));

  if (customerPhone && restaurant.orderNotificationsEnabled) {
    const trackingUrl = `${env.clientUrl}/r/${restaurant.slug}/order/${order.id}?t=${order.orderSessionToken}`;
    const itemsSummary = order.items.map((i) => `${i.quantity}x ${i.itemName}`).join(", ");
    messagingService
      .sendMessage({
        restaurantId: restaurant.id,
        orderId: order.id,
        phone: customerPhone,
        purpose: "order_confirmation",
        preferredChannel: restaurant.notificationChannel,
        body: `${restaurant.name}: Order ${order.orderNumber} confirmed! ${itemsSummary}. Total ₹${Number(order.totalAmount).toFixed(0)}. Track: ${trackingUrl}`,
      })
      .catch((err) => console.error("Order confirmation notification failed:", err.message));
  }

  return order;
}

// Order details, accessible either by the guest's session token (their own
// order only) or by authenticated staff/admin for their own restaurant.
async function getOrderForGuest(orderId, orderSessionToken) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, orderSessionToken },
    include: { items: true, table: true, payments: true, feedback: true },
  });
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

async function getOrderForStaff(restaurantId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { items: true, table: true, payments: true, feedback: true },
  });
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

async function listOrdersForRestaurant(restaurantId, { status, from, to, page = 1, pageSize = 20 }) {
  const where = {
    restaurantId,
    ...(status ? { status } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true, table: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { orders, total, page, pageSize };
}

async function updateOrderStatus(restaurantId, orderId, newStatus) {
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId } });
  if (!order) throw new ApiError(404, "Order not found");

  if (!canTransition(order.status, newStatus)) {
    throw new ApiError(400, `Cannot move order from ${order.status} to ${newStatus}`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
    include: { items: true, table: true },
  });

  emitOrderUpdated(restaurantId, orderSummary(updated));
  emitOrderStatus(updated.orderSessionToken, { orderId: updated.id, status: updated.status, updatedAt: updated.updatedAt });

  const NOTIFY_STATUSES = new Set(["READY", "COMPLETED", "CANCELLED"]);
  if (updated.customerPhone && NOTIFY_STATUSES.has(newStatus)) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (restaurant?.orderNotificationsEnabled) {
      const STATUS_MESSAGES = {
        READY: `Your order ${updated.orderNumber} is ready!`,
        COMPLETED: `Thanks for ordering from ${restaurant.name}! Order ${updated.orderNumber} is complete.`,
        CANCELLED: `Your order ${updated.orderNumber} at ${restaurant.name} was cancelled.`,
      };
      messagingService
        .sendMessage({
          restaurantId,
          orderId: updated.id,
          phone: updated.customerPhone,
          purpose: "order_status",
          preferredChannel: restaurant.notificationChannel,
          body: STATUS_MESSAGES[newStatus],
        })
        .catch((err) => console.error("Order status notification failed:", err.message));
    }
  }

  return updated;
}

function orderSummary(order) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    tableNumber: order.table?.tableNumber ?? null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    itemCount: order.items?.length,
    createdAt: order.createdAt,
  };
}

async function submitFeedback(orderId, orderSessionToken, { rating, comment }) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, orderSessionToken },
    include: { feedback: true },
  });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "COMPLETED") {
    throw new ApiError(400, "Feedback can only be left once the order is completed");
  }
  if (order.feedback) {
    throw new ApiError(409, "Feedback has already been submitted for this order");
  }

  return prisma.feedback.create({
    data: {
      orderId: order.id,
      restaurantId: order.restaurantId,
      rating,
      comment: comment || null,
    },
  });
}

module.exports = {
  createOrder,
  getOrderForGuest,
  getOrderForStaff,
  listOrdersForRestaurant,
  updateOrderStatus,
  orderSummary,
  submitFeedback,
};
