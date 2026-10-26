const test = require("node:test");
const assert = require("node:assert/strict");
const { migrationBlockers, summarizeRows, missingOrInvalidUniqueIndexes } = require("../scripts/migrate-production");
const { paymentVerifySchema } = require("../src/validators/schemas");

test("migration gate blocks duplicate groups and blank identifiers", () => {
  const rows = [
    { check_name: "Order(restaurantId, source, externalOrderId)", duplicate_groups: 1n, duplicate_rows: 2n },
    { check_name: "Order.idempotencyKey", blank_rows: 1n },
    { check_name: "Order.externalOrderId", null_rows: 4n },
    { check_name: "Payment.providerPaymentId", null_rows: 3n },
  ];

  assert.deepEqual(migrationBlockers(rows).map((row) => row.check_name), [
    "Order(restaurantId, source, externalOrderId)",
    "Order.idempotencyKey",
  ]);
  assert.equal(summarizeRows(rows)[2].nullRows, 4);
});

test("migration gate allows nullable identifiers while enforcing non-null source/provider", () => {
  const rows = [
    { check_name: "Order.externalOrderId", null_rows: 20n, blank_rows: 0n },
    { check_name: "Order.idempotencyKey", null_rows: 30n, blank_rows: 0n },
    { check_name: "Payment.providerPaymentId", null_rows: 15n, blank_rows: 0n },
    { check_name: "Order.source", null_rows: 1n, blank_rows: 0n },
  ];

  assert.deepEqual(migrationBlockers(rows).map((row) => row.check_name), ["Order.source"]);
});

test("payment verification rejects blank provider identifiers before persistence", () => {
  const base = { orderId: "3e78f944-4c37-4482-8f10-57a51db2a28b", orderSessionToken: "3e78f944-4c37-4482-8f10-57a51db2a28b", razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" };
  assert.equal(paymentVerifySchema.safeParse(base).success, true);
  assert.equal(paymentVerifySchema.safeParse({ ...base, razorpay_payment_id: "  " }).success, false);
});

test("migration gate detects missing, invalid, or mismatched recorded unique indexes", () => {
  const existing = [
    { index_name: "Order_restaurantId_source_externalOrderId_key", table_name: "Order", is_unique: true, is_valid: true, columns: ["restaurantId", "source", "externalOrderId"] },
    { index_name: "Order_restaurantId_idempotencyKey_key", table_name: "Order", is_unique: true, is_valid: true, columns: ["restaurantId", "idempotencyKey"] },
    { index_name: "Payment_provider_providerPaymentId_key", table_name: "Payment", is_unique: true, is_valid: true, columns: ["provider", "providerPaymentId"] },
  ];

  assert.deepEqual(missingOrInvalidUniqueIndexes(existing), []);
  assert.deepEqual(missingOrInvalidUniqueIndexes(existing.slice(0, 2)), ["Payment_provider_providerPaymentId_key"]);
  assert.deepEqual(missingOrInvalidUniqueIndexes([{ ...existing[0], is_valid: false }, ...existing.slice(1)]), ["Order_restaurantId_source_externalOrderId_key"]);
});
