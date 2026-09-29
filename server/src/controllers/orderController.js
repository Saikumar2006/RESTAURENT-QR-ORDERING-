const orderService = require("../services/orderService");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");

// Public: customer places an order. Only tableToken + items are trusted
// input; restaurantId/pricing are derived/recalculated server-side.
const createOrder = asyncHandler(async (req, res) => {
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

module.exports = { createOrder, getOrder, listOrders, updateOrderStatus, submitFeedback };
