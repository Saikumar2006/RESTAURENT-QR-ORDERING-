const orderService = require("../services/orderService");
const prisma = require("../config/db");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const { getRedisClient, isRedisEnabled } = require("../config/redis");
const { getCacheKey } = require("../services/redisService");
const { emitOrderUpdated } = require("../sockets");

// Public: customer places an order. Only tableToken + items are trusted
// input; restaurantId/pricing are derived/recalculated server-side.
// This handler implements an optional Redis-backed idempotency guard:
// - Client may send Idempotency-Key header
// - If configured, the server ensures a single order is created for a key
const createOrder = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get && (req.get('Idempotency-Key') || req.get('idempotency-key') || req.get('x-idempotency-key'));

  // If Redis isn't configured or no key was provided, proceed normally.
  if (!isRedisEnabled() || !idempotencyKey) {
    const order = await orderService.createOrder(req.body);
    created(res, {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      tableNumber: order.table?.tableNumber ?? null,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount,
      couponCode: order.couponCode,
      totalAmount: order.totalAmount,
      orderSessionToken: order.orderSessionToken,
      items: order.items,
    });
    return;
  }

  const redis = getRedisClient();
  const key = getCacheKey("idempotency:orders", idempotencyKey);
  const processingTtlSec = 5 * 60; // 5 minutes
  const resultTtlSec = 24 * 60 * 60; // 24 hours

  try {
    // Try to claim the idempotency key as "processing" atomically
    const claimed = await redis.set(key, JSON.stringify({ status: "processing", createdAt: Date.now() }), { NX: true, EX: processingTtlSec });
    if (!claimed) {
      // Key exists — inspect it
      const raw = await redis.get(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.orderId) {
            // Order already created for this key — return the same response
            const order = await orderService.getOrderForGuest(parsed.orderId, parsed.orderSessionToken || "");
            // Return 201 with same payload shape
            created(res, {
              id: order.id,
              orderNumber: order.orderNumber,
              orderType: order.orderType,
              tableNumber: order.table?.tableNumber ?? null,
              status: order.status,
              paymentStatus: order.paymentStatus,
              subtotal: order.subtotal,
              taxAmount: order.taxAmount,
              serviceCharge: order.serviceCharge,
              discountAmount: order.discountAmount,
              couponCode: order.couponCode,
              totalAmount: order.totalAmount,
              orderSessionToken: order.orderSessionToken,
              items: order.items,
            });
            return;
          }
          // If it's processing, return 202 Accepted so client can poll
          if (parsed && parsed.status === "processing") {
            return res.status(202).json({ success: true, data: { processing: true } });
          }
        } catch (e) {
          // non-JSON value — fall through to normal processing
        }
      }
      // Key exists but couldn't parse; return 202 to be safe
      return res.status(202).json({ success: true, data: { processing: true } });
    }

    // Claimed the key — proceed to create order
    try {
      const order = await orderService.createOrder(req.body);

      // Record result for future idempotent requests
      const value = { orderId: order.id, orderSessionToken: order.orderSessionToken, status: "created", createdAt: Date.now() };
      await redis.set(key, JSON.stringify(value), { EX: resultTtlSec });

      created(res, {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: order.table?.tableNumber ?? null,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        serviceCharge: order.serviceCharge,
        discountAmount: order.discountAmount,
        couponCode: order.couponCode,
        totalAmount: order.totalAmount,
        orderSessionToken: order.orderSessionToken,
        items: order.items,
      });
      return;
    } catch (err) {
      // On failure, remove the processing claim so client may retry
      try {
        await redis.del(key);
      } catch (ignore) {}
      throw err;
    }
  } catch (err) {
    // If Redis errors, log and fall back to normal processing (fail-open)
    console.error("Idempotency Redis error:", err.message || err);
    const order = await orderService.createOrder(req.body);
    created(res, {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      tableNumber: order.table?.tableNumber ?? null,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount,
      couponCode: order.couponCode,
      totalAmount: order.totalAmount,
      orderSessionToken: order.orderSessionToken,
      items: order.items,
    });
  }
});

// Accessible either by the guest session token (query param) or by
// authenticated staff/admin for their own restaurant.
const getOrder = asyncHandler(async (req, res) => {
  if (req.user) {
    const order = await orderService.getOrderForStaff(req.user.restaurantId, req.params.id);
    return ok(res, order);
  }
  const token = req.query.orderSessionToken;
  if (!token) throw new ApiError(401, "Missing order session token");
  const order = await orderService.getOrderForGuest(req.params.id, token);
  ok(res, order);
});

const listOrders = asyncHandler(async (req, res) => {
  const { status, from, to, page, pageSize } = req.query;
  const result = await orderService.listOrdersForRestaurant(req.user.restaurantId, {
    status,
    from,
    to,
    page: page ? parseInt(page, 10) : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
  });
  ok(res, result.orders, { total: result.total, page: result.page, pageSize: result.pageSize });
});

const getActiveOrderForTable = asyncHandler(async (req, res) => {
  const order = await orderService.getActiveOrderForTable(req.user.restaurantId, req.params.id);
  ok(res, order);
});

const addItemsToActiveOrder = asyncHandler(async (req, res) => {
  const order = await orderService.addItemsToActiveOrder(req.user.restaurantId, req.params.id, req.body.items);
  emitOrderUpdated(req.user.restaurantId, orderService.orderSummary(order));
  ok(res, order);
});

const getReceipt = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderForStaff(req.user.restaurantId, req.params.id);
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.user.restaurantId },
    select: { name: true },
  });
  ok(res, orderService.buildReceiptData(order, restaurant));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.user.restaurantId, req.params.id, req.body.status);
  ok(res, order);
});

// Public: guest leaves a star rating + optional comment on their own
// completed order. Authenticated by the same orderSessionToken as polling
// (see getOrder above) rather than a login — there's no customer account
// system in this app by design.
const submitFeedback = asyncHandler(async (req, res) => {
  const token = req.body.orderSessionToken;
  if (!token) throw new ApiError(401, "Missing order session token");
  const feedback = await orderService.submitFeedback(req.params.id, token, req.body);
  created(res, feedback);
});

module.exports = { createOrder, getOrder, listOrders, getActiveOrderForTable, addItemsToActiveOrder, getReceipt, updateOrderStatus, submitFeedback };
