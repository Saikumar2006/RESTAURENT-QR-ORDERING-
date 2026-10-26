const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");
const env = require("../src/config/env");
const { getPaymentProvider } = require("../src/services/paymentProvider");

test("Razorpay webhook HMAC verifies the exact raw body and rejects tampering", () => {
  const previousProvider = env.paymentProvider;
  const previousSecret = env.razorpayWebhookSecret;
  try {
    env.paymentProvider = "razorpay";
    env.razorpayWebhookSecret = "test-webhook-secret";
    const provider = getPaymentProvider();
    const rawBody = Buffer.from('{"event":"payment.captured","id":"evt-test"}');
    const signature = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
    assert.equal(provider.verifyWebhookSignature(rawBody, signature), true);
    assert.equal(provider.verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature), false);
    assert.equal(provider.verifyWebhookSignature(rawBody, "bad-signature"), false);
  } finally {
    env.paymentProvider = previousProvider;
    env.razorpayWebhookSecret = previousSecret;
  }
});
