const orderService = require("../services/orderService");
const prisma = require("../config/db");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const { getRedisClient, isRedisEnabled } = require("../config/redis");
const { getCacheKey } = require("../services/redisService");
const { emitOrderUpdated } = require("../sockets");
const crypto = require("crypto");

function customerOrderPayload(order) {
  return {
    id: order.id, orderNumber: order.orderNumber, orderType: order.orderType,
    tableNumber: order.table?.tableNumber ?? null, status: order.status, paymentStatus: order.paymentStatus,
    subtotal: order.subtotal, taxAmount: order.taxAmount, serviceCharge: order.serviceCharge,
    discountAmount: order.discountAmount, couponCode: order.couponCode, totalAmount: order.totalAmount,
    orderSessionToken: order.orderSessionToken, items: order.items,
  };
}

// Public: customer places an order. Only tableToken + items are trusted
// input; restaurantId/pricing are derived/recalculated server-side.
// This handler implements an optional Redis-backed idempotency guard:
// - Client may send Idempotency-Key header
// - If configured, the server ensures a single order is created for a key
const createOrder = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get && (req.get('Idempotency-Key') || req.get('idempotency-key') || req.get('x-idempotency-key'));
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new ApiError(400, "Invalid idempotency key");
  const idempotencyFingerprint = crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex");
  const createInput = {
    ...req.body,
    idempotencyKey: idempotencyKey ? crypto.createHash("sha256").update(idempotencyKey).digest("hex") : undefined,
    idempotencyFingerprint,
  };

  // If Redis isn't configured or no key was provided, proceed normally.
  if (!isRedisEnabled() || !idempotencyKey) {
    const order = await orderService.createOrder(createInput);
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
  let creatingOrder = false;
  let completedOrder = null;

  try {
    // Try to claim the idempotency key as "processing" atomically
    const claimed = await redis.set(key, JSON.stringify({ status: "processing", fingerprint: idempotencyFingerprint, createdAt: Date.now() }), { NX: true, EX: processingTtlSec });
    if (!claimed) {
      // Key exists — inspect it
      const raw = await redis.get(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.fingerprint && parsed.fingerprint !== idempotencyFingerprint) throw new ApiError(409, "This idempotency key was already used for a different order");
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
            creatingOrder = true;
            const order = await orderService.createOrder(createInput);
            completedOrder = order;
            return created(res, customerOrderPayload(order));
          }
      } catch (e) {
          if (e instanceof ApiError) throw e;
          // non-JSON value — fall through to normal processing
        }
      }
      // Key exists but couldn't parse; return 202 to be safe
      creatingOrder = true;
      const order = await orderService.createOrder(createInput);
      completedOrder = order;
      return created(res, customerOrderPayload(order));
    }

    // Claimed the key — proceed to create order
    try {
      creatingOrder = true;
      const order = await orderService.createOrder(createInput);
      completedOrder = order;

      // Record result for future idempotent requests
      const value = { orderId: order.id, orderSessionToken: order.orderSessionToken, fingerprint: idempotencyFingerprint, status: "created", createdAt: Date.now() };
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
      // Keep the processing claim until its short TTL. If the DB committed
      // before a follow-up operation failed, removing it could duplicate.
      throw err;
    }
  } catch (err) {
    if (completedOrder) return created(res, customerOrderPayload(completedOrder));
    // Do not retry order creation if the service may already have committed
    // before failing in a follow-up step (for example coupon accounting).
    if (creatingOrder) throw err;
    // If Redis errors, log and fall back to normal processing (fail-open)
    console.error(JSON.stringify({ event: "dependency_operation_failed", category: "redis_idempotency", timestamp: new Date().toISOString() }));
    const order = await orderService.createOrder(createInput);
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
    if (!req.user.permissions?.includes("*") && !req.user.permissions?.includes("orders.view")) {
      throw new ApiError(403, "You do not have permission to view orders");
    }
    const order = await orderService.getOrderForStaff(req.user.restaurantId, req.params.id);
    return ok(res, order);
  }
  const token = req.query.orderSessionToken;
  if (!token) throw new ApiError(401, "Missing order session token");
  const order = await orderService.getOrderForGuest(req.params.id, token);
  ok(res, order);
});

const listOrders = asyncHandler(async (req, res) => {
  const { status, source, search, from, to, page, pageSize } = req.query;
  const sources = new Set(["SVAADYA_QR", "SVAADYA_WEBSITE", "SWIGGY", "ZOMATO", "MANUAL"]);
  if (source && !sources.has(source)) throw new ApiError(400, "Invalid order source filter");
  if (status && !["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"].includes(status)) {
    throw new ApiError(400, "Invalid order status filter");
  }
  for (const value of [from, to]) {
    if (value && !Number.isFinite(Date.parse(value))) throw new ApiError(400, "Invalid order date filter");
  }
  const pageNumber = page === undefined ? 1 : Number(page);
  const pageSizeNumber = pageSize === undefined ? 20 : Number(pageSize);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(pageSizeNumber) || pageSizeNumber < 1) {
    throw new ApiError(400, "Invalid pagination values");
  }
  const result = await orderService.listOrdersForRestaurant(req.user.restaurantId, {
    status,
    source,
    search: typeof search === "string" ? search.trim().slice(0, 100) : undefined,
    from,
    to,
    page: pageNumber,
    pageSize: Math.min(pageSizeNumber, 100),
  });
  ok(res, result.orders, { total: result.total, page: result.page, pageSize: result.pageSize });
});

const createManualOrder = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const order = await orderService.createManualOrder(req.user.restaurantId, req.user.id, req.body);
  created(res, order);
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
  const requiredPermission = req.body.status === "CANCELLED"
    ? "orders.cancel"
    : req.body.status === "COMPLETED"
      ? "orders.complete"
      : "orders.update";
  if (!req.user.permissions?.includes("*") && !req.user.permissions?.includes(requiredPermission)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
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

module.exports = { createOrder, getOrder, listOrders, createManualOrder, getActiveOrderForTable, addItemsToActiveOrder, getReceipt, updateOrderStatus, submitFeedback };
