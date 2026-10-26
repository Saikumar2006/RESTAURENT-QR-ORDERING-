const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { getPaymentProvider } = require("./paymentProvider");
const { emitPaymentUpdated, emitOrderUpdated } = require("../sockets");
const { orderSummary } = require("./orderService");

// Step 1 of the payment flow: backend creates a provider payment order using
// the AUTHORITATIVE amount already stored on the order (never a client-sent
// amount), and records a PENDING Payment row.
async function createPaymentOrder(orderId, orderSessionToken) {
  const order = await prisma.order.findFirst({ where: { id: orderId, orderSessionToken }, include: { restaurant: { select: { currency: true } } } });
  if (!order) throw new ApiError(404, "Order not found");
  if (["SWIGGY", "ZOMATO"].includes(order.source)) throw new ApiError(409, "Marketplace orders are paid through the marketplace and cannot be charged here.");
  if (order.paymentMethod !== "ONLINE") throw new ApiError(409, "This order is not configured for online payment.");
  if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new ApiError(409, "Closed orders cannot be paid online.");
  if (order.paymentStatus === "PAID") throw new ApiError(409, "This order is already paid");

  const provider = getPaymentProvider();
  const currency = order.restaurant?.currency || "INR";
  if (currency !== "INR") throw new ApiError(409, "Online payments currently support INR orders only.");
  const existing = await prisma.payment.findFirst({ where: { orderId: order.id, provider: provider.name, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (existing) {
    if (Number(existing.amount) !== Number(order.totalAmount) || (existing.currency || currency) !== currency) {
      throw new ApiError(409, "An open payment attempt uses an earlier order total. Resolve that attempt before retrying.");
    }
    return {
      paymentId: existing.id,
      providerOrderId: existing.providerOrderId,
      amount: Math.round(Number(existing.amount) * 100),
      currency: existing.currency || currency,
      provider: provider.name,
      razorpayKeyId: provider.name === "razorpay" ? require("../config/env").razorpayKeyId : undefined,
    };
  }
  const providerOrder = await provider.createOrder({
    amount: Number(order.totalAmount),
    currency,
    receipt: order.orderNumber,
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerOrderId: providerOrder.id,
      amount: order.totalAmount,
      currency,
      status: "PENDING",
    },
  });

  return {
    paymentId: payment.id,
    providerOrderId: providerOrder.id,
    amount: providerOrder.amount,
    currency: providerOrder.currency,
    provider: provider.name,
    // Public key is safe to expose to the client checkout widget; the
    // secret key never leaves the server.
    razorpayKeyId: provider.name === "razorpay" ? require("../config/env").razorpayKeyId : undefined,
  };
}

// Step 2: verify the payment response returned to the browser. Frontend
// "success" is never trusted on its own — signature verification here is
// what actually flips paymentStatus to PAID.
async function verifyPayment({ orderId, orderSessionToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const order = await prisma.order.findFirst({ where: { id: orderId, orderSessionToken }, include: { restaurant: { select: { currency: true } } } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentMethod !== "ONLINE" || ["COMPLETED", "CANCELLED"].includes(order.status)) {
    throw new ApiError(409, "This order is no longer eligible for online payment.");
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, providerOrderId: razorpay_order_id },
  });
  if (!payment) throw new ApiError(404, "Payment record not found for this order");
  if (payment.provider !== getPaymentProvider().name) throw new ApiError(409, "Payment provider does not match this payment attempt");
  if (payment.status === "PAID" && payment.providerPaymentId === razorpay_payment_id) return { payment, order };

  const provider = getPaymentProvider();
  const isValid = await provider.verifyPayment({
    providerOrderId: razorpay_order_id,
    providerPaymentId: razorpay_payment_id,
    providerSignature: razorpay_signature,
  });

  if (!isValid) {
    await prisma.payment.update({
      where: { id: payment.id },
      // Never persist an unverified provider ID: a forged ID can collide with
      // the provider's global uniqueness key and must not claim that payment.
      data: { status: "FAILED", failureReason: "Signature verification failed" },
    });
    throw new ApiError(400, "Payment could not be verified. Please try again.");
  }

  if (provider.name !== "mock") {
    const providerPayment = await provider.fetchPayment(razorpay_payment_id);
    if (providerPayment.order_id !== payment.providerOrderId
      || providerPayment.currency !== (payment.currency || order.restaurant?.currency || "INR")
      || Number(providerPayment.amount) !== Math.round(Number(payment.amount) * 100)
      || providerPayment.status !== "captured") {
      throw new ApiError(409, "The provider has not confirmed a captured payment for this order.");
    }
  }

  const { updatedPayment, updatedOrder } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "PAID", providerPaymentId: razorpay_payment_id, providerSignature: razorpay_signature },
    });
    if (claimed.count !== 1) {
      const latest = await tx.payment.findUnique({ where: { id: payment.id } });
      if (latest?.status === "PAID" && latest.providerPaymentId === razorpay_payment_id) {
        const paidOrder = await tx.order.findUnique({ where: { id: order.id }, include: { items: true, table: true } });
        return { updatedPayment: latest, updatedOrder: paidOrder };
      }
      throw new ApiError(409, "This payment attempt has already been processed.");
    }
    const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
    if (!currentOrder || currentOrder.paymentMethod !== "ONLINE"
      || ["COMPLETED", "CANCELLED"].includes(currentOrder.status)
      || Number(currentOrder.totalAmount) !== Number(payment.amount)) {
      throw new ApiError(409, "Order changed or closed before payment confirmation.");
    }
    const updatedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
    const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" }, include: { items: true, table: true } });
    return { updatedPayment, updatedOrder };
  });

  emitPaymentUpdated(order.orderSessionToken, order.restaurantId, { orderId: order.id, paymentStatus: "PAID" });
  emitOrderUpdated(order.restaurantId, orderSummary(updatedOrder));

  return { payment: updatedPayment, order: updatedOrder };
}

// Step 3: asynchronous, idempotent webhook reconciliation. This is the
// authoritative backstop for cases where the browser closes before
// verifyPayment completes.
async function handleWebhook(rawBody, signatureHeader, payload) {
  const provider = getPaymentProvider();
  const validSignature = provider.verifyWebhookSignature(rawBody, signatureHeader);
  if (!validSignature) throw new ApiError(400, "Invalid webhook signature");

  const event = payload.event; // e.g. "payment.captured", "payment.failed"
  const providerPaymentEntity = payload.payload?.payment?.entity;
  if (!providerPaymentEntity) return { ignored: true };

  const providerOrderId = providerPaymentEntity.order_id;
  const providerPaymentId = providerPaymentEntity.id;

  const payment = await prisma.payment.findFirst({ where: { providerOrderId }, include: { order: { include: { restaurant: { select: { currency: true } } } } } });
  if (!payment) return { ignored: true, reason: "unknown providerOrderId" };

  // Idempotency: if we've already recorded this exact payment id as PAID,
  // do nothing further — duplicate webhook delivery must not double-process.
  if (payment.status === "PAID") {
    return { alreadyProcessed: true };
  }

  const newStatus = event === "payment.captured" ? "PAID" : event === "payment.failed" ? "FAILED" : payment.status;
  if (newStatus === payment.status) return { ignored: true };
  if (newStatus === "PAID" && (
    providerPaymentEntity.order_id !== payment.providerOrderId
    || providerPaymentEntity.currency !== (payment.currency || payment.order.restaurant?.currency || "INR")
    || Number(providerPaymentEntity.amount) !== Math.round(Number(payment.amount) * 100)
  )) throw new ApiError(400, "Payment webhook amount or order does not match the payment attempt");

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: newStatus, providerPaymentId, rawWebhookPayload: JSON.stringify(payload) },
    });
    if (claimed.count !== 1) return { alreadyProcessed: true };
    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
    let updatedOrder = null;
    const capturedAmountMatchesCurrentOrder = Number(order.totalAmount) === Number(payment.amount)
      && order.paymentMethod === "ONLINE"
      && !["COMPLETED", "CANCELLED"].includes(order.status);
    if (newStatus === "PAID" && order.paymentStatus !== "PAID" && capturedAmountMatchesCurrentOrder) {
      updatedOrder = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" }, include: { items: true, table: true } });
    }
    return { order, updatedOrder, discrepancy: newStatus === "PAID" && !capturedAmountMatchesCurrentOrder };
  });

  if (result.alreadyProcessed) return result;
  if (result.updatedOrder) {
    const order = result.order;
    const updatedOrder = result.updatedOrder;
    emitPaymentUpdated(order.orderSessionToken, order.restaurantId, { orderId: order.id, paymentStatus: "PAID" });
    emitOrderUpdated(order.restaurantId, orderSummary(updatedOrder));
  }

  return { processed: true, status: newStatus, ...(result.discrepancy ? { reconciliationRequired: true } : {}) };
}

module.exports = { createPaymentOrder, verifyPayment, handleWebhook };
