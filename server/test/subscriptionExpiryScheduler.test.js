const test = require("node:test");
const assert = require("node:assert/strict");
const { startSubscriptionExpirySweep } = require("../src/services/subscriptionExpiryScheduler");

function makeHarness(rows) {
  const events = [];
  let callback;
  let cleared = null;
  const database = {
    async $queryRawUnsafe() { return rows; },
  };
  const logger = { error(message) { events.push(JSON.parse(message)); } };
  const setIntervalFn = (fn) => {
    callback = fn;
    return { unref() { events.push({ event: "timer_unreferenced" }); } };
  };
  const clearIntervalFn = (timer) => { cleared = timer; };
  return { events, database, logger, setIntervalFn, clearIntervalFn, get callback() { return callback; }, get cleared() { return cleared; } };
}

test("missing subscription tables are logged clearly and do not schedule a retry loop", async () => {
  const harness = makeHarness([
    { name: "PendingOnboarding", present: false },
    { name: "Subscription", present: false },
  ]);
  const result = await startSubscriptionExpirySweep(harness);

  assert.equal(result.started, false);
  assert.deepEqual(result.missingTables, ["PendingOnboarding", "Subscription"]);
  assert.equal(harness.callback, undefined);
  assert.equal(harness.events.length, 1);
  assert.deepEqual(harness.events[0].missingTables, ["PendingOnboarding", "Subscription"]);
});

test("schema check failures disable the worker and emit one sanitized diagnostic", async () => {
  const harness = makeHarness([]);
  harness.database.$queryRawUnsafe = async () => { throw { code: "P1001" }; };
  const result = await startSubscriptionExpirySweep(harness);

  assert.equal(result.started, false);
  assert.equal(harness.callback, undefined);
  assert.deepEqual(harness.events, [{
    event: "subscription_expiry_sweep_disabled",
    category: "billing_lifecycle",
    reason: "schema_dependency_check_failed",
    code: "P1001",
  }]);
});

test("a missing table discovered during a sweep stops future runs", async () => {
  const harness = makeHarness([
    { name: "PendingOnboarding", present: true },
    { name: "Subscription", present: true },
  ]);
  const result = await startSubscriptionExpirySweep({
    ...harness,
    runSweep: async () => { throw { code: "P2021" }; },
  });

  assert.equal(result.started, true);
  await harness.callback();
  assert.equal(harness.cleared, result.timer);
  assert.deepEqual(harness.events.at(-1), {
    event: "subscription_expiry_sweep_disabled",
    category: "billing_lifecycle",
    reason: "schema_dependency_missing_during_sweep",
    code: "P2021",
  });
});
