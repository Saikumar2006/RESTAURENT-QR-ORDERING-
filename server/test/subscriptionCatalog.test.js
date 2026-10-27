process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-with-enough-entropy";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePricing } = require("../src/services/subscriptionCatalog");
const { addBillingPeriod, expireSubscriptions } = require("../src/services/subscriptionService");
const { createSignature, verifyWebhookSignature } = require("../src/services/saasPaymentProvider");

const completePrices = Object.fromEntries(["BASIC", "STANDARD", "PREMIUM"].map((plan, index) => [plan, {
  MONTHLY: 100 + index, "3_MONTHS": 280 + index, "6_MONTHS": 500 + index, YEARLY: 900 + index,
}]));

test("subscription pricing only enables checkout with all plans and periods set to positive amounts", () => {
  const complete = parsePricing(JSON.stringify(completePrices));
  assert.equal(complete.configured, true);
  assert.equal(complete.prices.PREMIUM.YEARLY, 902);
  assert.equal(parsePricing("").configured, false);
  assert.equal(parsePricing("not-json").error, "pricing_invalid");
  const incomplete = structuredClone(completePrices);
  delete incomplete.BASIC.MONTHLY;
  assert.equal(parsePricing(JSON.stringify(incomplete)).configured, false);
  const invalid = structuredClone(completePrices);
  invalid.PREMIUM.YEARLY = 0;
  assert.equal(parsePricing(JSON.stringify(invalid)).configured, false);
});

test("subscription periods advance by calendar months and clamp end-of-month dates", () => {
  assert.equal(addBillingPeriod(new Date("2026-01-31T12:00:00.000Z"), "MONTHLY").toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(addBillingPeriod(new Date("2024-02-29T12:00:00.000Z"), "YEARLY").toISOString(), "2025-02-28T12:00:00.000Z");
  assert.throws(() => addBillingPeriod(new Date(), "INVALID"), { status: 400 });
});

test("subscription webhook signatures bind the exact payload and reject malformed signatures", () => {
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const signature = createSignature("unit-test-secret", rawBody);
  assert.equal(verifyWebhookSignature(rawBody, signature, "unit-test-secret"), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, "unit-test-secret"), false);
  assert.equal(verifyWebhookSignature(rawBody, "bad", "unit-test-secret"), false);
  assert.equal(verifyWebhookSignature(rawBody, signature, ""), false);
});

test("subscription expiry worker is safe to rerun and clears only expired onboarding claims", async () => {
  const calls = [];
  const database = {
    subscription: { async updateMany(input) { calls.push(input); return { count: calls.length === 1 ? 2 : 0 }; } },
    pendingOnboarding: { async updateMany(input) { calls.push(input); return { count: 3 }; } },
  };
  const now = new Date("2026-10-26T00:00:00.000Z");
  const result = await expireSubscriptions(database, now);
  assert.deepEqual(result, { expired: 2 });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.where.status));
  assert.equal(calls[3].data.emailClaim, null);
  assert.equal(calls[3].data.passwordHash, null);
});
