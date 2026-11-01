const assert = require("node:assert/strict");
const { test } = require("node:test");

test("invalid payment signatures do not mutate a pending payment attempt", async () => {
  const servicePath = require.resolve("../src/services/paymentService");
  const prismaPath = require.resolve("../src/config/db");
  const providerPath = require.resolve("../src/services/paymentProvider");
  const socketsPath = require.resolve("../src/sockets");
  const orderServicePath = require.resolve("../src/services/orderService");
  const paths = [servicePath, prismaPath, providerPath, socketsPath, orderServicePath];
  const previousModules = new Map(paths.map((path) => [path, require.cache[path]]));
  let updateCalls = 0;

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      order: {
        async findFirst() {
          return {
            id: "order-1",
            orderSessionToken: "session-token",
            paymentMethod: "ONLINE",
            status: "PENDING",
            paymentStatus: "PENDING",
            totalAmount: 25,
            restaurant: { currency: "INR" },
          };
        },
      },
      payment: {
        async findFirst() {
          return {
            id: "payment-1",
            orderId: "order-1",
            providerOrderId: "provider-order-1",
            provider: "razorpay",
            status: "PENDING",
            amount: 25,
            currency: "INR",
          };
        },
        async update() {
          updateCalls += 1;
        },
      },
    },
  };
  require.cache[providerPath] = {
    id: providerPath,
    filename: providerPath,
    loaded: true,
    exports: {
      getPaymentProvider: () => ({
        name: "razorpay",
        async verifyPayment() {
          return false;
        },
      }),
    },
  };
  require.cache[socketsPath] = {
    id: socketsPath,
    filename: socketsPath,
    loaded: true,
    exports: { emitPaymentUpdated() {}, emitOrderUpdated() {} },
  };
  require.cache[orderServicePath] = {
    id: orderServicePath,
    filename: orderServicePath,
    loaded: true,
    exports: { orderSummary() {} },
  };
  delete require.cache[servicePath];

  try {
    const paymentService = require("../src/services/paymentService");
    await assert.rejects(
      paymentService.verifyPayment({
        orderId: "order-1",
        orderSessionToken: "session-token",
        razorpay_order_id: "provider-order-1",
        razorpay_payment_id: "unverified-payment",
        razorpay_signature: "invalid-signature",
      }),
      { status: 400 }
    );
    assert.equal(updateCalls, 0);
  } finally {
    for (const path of paths) {
      delete require.cache[path];
      if (previousModules.get(path)) require.cache[path] = previousModules.get(path);
    }
  }
});
