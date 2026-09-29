const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { getPaymentProvider } = require("./paymentProvider");
const { emitPaymentUpdated, emitOrderUpdated } = require("../sockets");
const { orderSummary } = require("./orderService");

// Step 1 of the payment flow: backend creates a provider payment order using
// the AUTHORITATIVE amount already stored on the order (never a client-sent
// amount), and records a PENDING Payment row.
async function createPaymentOrder(orderId, orderSessionToken) {
  const order = await prisma.order.findFirst({ where: { id: orderId, orderSessionToken } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentStatus === "PAID") throw new ApiError(409, "This order is already paid");

  const provider = getPaymentProvider();
  const providerOrder = await provider.createOrder({
    amount: Number(order.totalAmount),
    currency: "INR",
    receipt: order.orderNumber,
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerOrderId: providerOrder.id,
      amount: order.totalAmount,
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
  const order = await prisma.order.findFirst({ where: { id: orderId, orderSessionToken } });
  if (!order) throw new ApiError(404, "Order not found");

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, providerOrderId: razorpay_order_id },
  });
  if (!payment) throw new ApiError(404, "Payment record not found for this order");

  const provider = getPaymentProvider();
  const isValid = await provider.verifyPayment({
    providerOrderId: razorpay_order_id,
    providerPaymentId: razorpay_payment_id,
    providerSignature: razorpay_signature,
  });

  if (!isValid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "Signature verification failed", providerPaymentId: razorpay_payment_id },
    });
    throw new ApiError(400, "Payment could not be verified. Please try again.");
  }

  const [updatedPayment, updatedOrder] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", providerPaymentId: razorpay_payment_id, providerSignature: razorpay_signature },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" },
      include: { items: true, table: true },
    }),
  ]);

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

  const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
  if (!payment) return { ignored: true, reason: "unknown providerOrderId" };

  // Idempotency: if we've already recorded this exact payment id as PAID,
  // do nothing further — duplicate webhook delivery must not double-process.
  if (payment.status === "PAID" && payment.providerPaymentId === providerPaymentId) {
    return { alreadyProcessed: true };
  }

  const newStatus = event === "payment.captured" ? "PAID" : event === "payment.failed" ? "FAILED" : payment.status;

  const [updatedPayment, order] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        providerPaymentId,
        // Stored as a JSON string (see the schema comment on this field)
        // (see the note in schema.prisma). Parse with JSON.parse(...) if
        // you ever need to read this field back programmatically.
        rawWebhookPayload: JSON.stringify(payload),
      },
    }),
    prisma.order.findUnique({ where: { id: payment.orderId } }),
  ]);

  if (newStatus === "PAID" && order.paymentStatus !== "PAID") {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" },
      include: { items: true, table: true },
    });
    emitPaymentUpdated(order.orderSessionToken, order.restaurantId, { orderId: order.id, paymentStatus: "PAID" });
    emitOrderUpdated(order.restaurantId, orderSummary(updatedOrder));
  }

  return { processed: true, status: newStatus };
}

module.exports = { createPaymentOrder, verifyPayment, handleWebhook };
