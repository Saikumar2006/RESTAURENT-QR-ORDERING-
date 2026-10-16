const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getProvider, listProviderStatus } = require("../src/services/orderProviders");

test("unapproved marketplace sources stay disconnected and reject ingestion", async () => {
  const statuses = Object.fromEntries(listProviderStatus().map((entry) => [entry.provider, entry.status]));
  assert.equal(statuses.SWIGGY, "NOT_CONFIGURED");
  assert.equal(statuses.ZOMATO, "NOT_CONFIGURED");
  await assert.rejects(getProvider("SWIGGY").ingest(), { status: 503 });
  await assert.rejects(getProvider("ZOMATO").ingest(), { status: 503 });
});

test("manual entry is the only active fallback source besides Svaadya QR", () => {
  const statuses = Object.fromEntries(listProviderStatus().map((entry) => [entry.provider, entry.status]));
  assert.equal(statuses.SVAADYA_QR, "CONNECTED");
  assert.equal(statuses.MANUAL, "AVAILABLE");
});
