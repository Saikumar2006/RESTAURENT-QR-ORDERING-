const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getProvider, getTestFixture, listProviderStatus } = require("../src/services/orderProviders");

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

test("marketplace fixtures are synthetic, normalized, and never persisted", () => {
  for (const provider of ["SWIGGY", "ZOMATO"]) {
    const fixture = getTestFixture(provider);
    assert.equal(fixture.mode, "TEST_FIXTURE");
    assert.equal(fixture.persisted, false);
    assert.equal(fixture.normalizedOrder.source, provider);
    assert.equal(fixture.normalizedOrder.externalOrderId, `fixture-${provider.toLowerCase()}-001`);
    assert.equal(fixture.normalizedOrder.paymentMethod, "MARKETPLACE");
    assert.match(fixture.note, /not a real or official marketplace payload/);
  }
  assert.throws(() => getTestFixture("SVAADYA_QR"), { status: 400 });
});
