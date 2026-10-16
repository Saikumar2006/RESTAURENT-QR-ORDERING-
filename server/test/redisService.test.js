const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

const redisConfigPath = require.resolve("../src/config/redis");
let redis;
let service;

function loadService(client) {
  redis = client;
  require.cache[redisConfigPath] = {
    id: redisConfigPath,
    filename: redisConfigPath,
    loaded: true,
    exports: {
      getRedisClient: () => redis,
      isRedisEnabled: () => Boolean(redis),
    },
  };
  delete require.cache[require.resolve("../src/services/redisService")];
  service = require("../src/services/redisService");
}

beforeEach(() => loadService(null));

test("cache keys namespace values and JSON reads/writes use an expiry", async () => {
  const store = new Map();
  const client = {
    async get(key) { return store.get(key) || null; },
    async set(key, value, options) { store.set(key, value); client.options = options; },
  };
  loadService(client);

  const key = service.getCacheKey("restaurant:menu", "tenant-1:public");
  assert.equal(key, "svaadya:v1:restaurant:menu:tenant-1:public");
  assert.equal(await service.setCachedJson(key, [{ name: "Soup" }], 42), true);
  assert.deepEqual(client.options, { EX: 42 });
  assert.deepEqual(await service.getCachedJson(key), [{ name: "Soup" }]);
});

test("pattern invalidation uses SCAN and deletes matching keys in batches", async () => {
  const deleted = [];
  const client = {
    async *scanIterator(options) {
      assert.deepEqual(options, { MATCH: "svaadya:v1:tenant:*", COUNT: 100 });
      yield "tenant:a";
      yield "tenant:b";
    },
    async del(keys) { deleted.push(...keys); },
    async keys() { throw new Error("KEYS must not be used"); },
  };
  loadService(client);

  assert.equal(await service.deletePattern("tenant:*"), true);
  assert.deepEqual(deleted, ["tenant:a", "tenant:b"]);
});

test("fixed-window rate limits increment atomically and report remaining quota", async () => {
  let evalArgs;
  const client = {
    async eval(script, options) {
      evalArgs = { script, options };
      return 3;
    },
  };
  loadService(client);

  const result = await service.incrementRateLimit("auth:global:ip", 60_000, 5);
  assert.deepEqual(result, { allowed: true, remaining: 2, retryAfterSeconds: 0 });
  assert.match(evalArgs.options.keys[0], /^svaadya:v1:rate-limit:auth:global:ip:\d+$/);
  assert.deepEqual(evalArgs.options.arguments, ["60"]);
});

test("Redis outages fail open for cache operations but retain a local rate limit", async () => {
  const client = {
    async get() { throw new Error("connection failed"); },
    async set() { throw new Error("connection failed"); },
    async del() { throw new Error("connection failed"); },
    async *scanIterator() { throw new Error("connection failed"); },
    async eval() { throw new Error("connection failed"); },
  };
  loadService(client);

  assert.equal(await service.getCachedJson("key"), null);
  assert.equal(await service.setCachedJson("key", {}), false);
  assert.equal(await service.deleteCachedKey("key"), false);
  assert.equal(await service.deletePattern("key:*"), false);
  assert.deepEqual(await service.incrementRateLimit("key", 60_000, 2), {
    allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: true,
  });
  assert.equal((await service.incrementRateLimit("key", 60_000, 2)).allowed, true);
  const blocked = await service.incrementRateLimit("key", 60_000, 2);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60);
  assert.equal(blocked.degraded, true);
});

test("TTL values are bounded and absent Redis is a clean no-op", async () => {
  assert.equal(service.resolveCacheTTL(-1), 1);
  assert.equal(service.resolveCacheTTL("invalid"), 300);
  assert.equal(service.resolveCacheTTL(1_000_000), 86400);
  assert.equal(await service.getCachedJson("key"), null);
  assert.equal(await service.setCachedJson("key", {}), false);
  assert.deepEqual(await service.incrementRateLimit("key", 1000, 3), { allowed: true, remaining: 3 });
});
