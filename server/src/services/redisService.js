const { getRedisClient, isRedisEnabled } = require("../config/redis");
const env = require("../config/env");

const DEFAULT_CACHE_TTL_SECONDS = 300;
const localRateLimitBuckets = new Map();

function getCacheKey(prefix, value) {
  return `${env.redisKeyPrefix}:${prefix}:${String(value)}`;
}

function withTimeout(operation) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redis operation timed out")), env.redisOperationTimeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}

async function getCachedJson(key) {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await withTimeout(redis.get(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // Cache is an optimization; a Redis outage or corrupt value must not
    // prevent the authoritative database read from serving the request.
    return null;
  }
}

async function setCachedJson(key, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await withTimeout(redis.set(key, JSON.stringify(value), { EX: resolveCacheTTL(ttlSeconds) }));
    return true;
  } catch {
    return false;
  }
}

async function deleteCachedKey(key) {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await withTimeout(redis.del(key));
    return true;
  } catch {
    return false;
  }
}

async function deletePattern(pattern) {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    let batch = [];
    for await (const key of redis.scanIterator({ MATCH: `${env.redisKeyPrefix}:${pattern}`, COUNT: 100 })) {
      batch.push(key);
      if (batch.length === 100) {
        await withTimeout(redis.del(batch));
        batch = [];
      }
    }
    if (batch.length) await withTimeout(redis.del(batch));
    return true;
  } catch {
    return false;
  }
}

async function incrementRateLimit(key, windowMs, limit) {
  const redis = getRedisClient();
  if (!redis) return { allowed: true, remaining: limit };

  const now = Date.now();
  const ttlSeconds = Math.ceil(windowMs / 1000);
  const bucket = getCacheKey("rate-limit", `${key}:${Math.floor(now / windowMs)}`);
  let current;
  try {
    current = Number(await withTimeout(redis.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count",
      { keys: [bucket], arguments: [String(ttlSeconds)] }
    )));
  } catch {
    // Keep a per-process fixed-window limit during a Redis outage instead of
    // silently disabling auth and ordering throttles.
    return incrementLocalRateLimit(key, windowMs, limit, Date.now());
  }

  const remaining = Math.max(0, limit - current);
  return {
    allowed: current <= limit,
    remaining,
    retryAfterSeconds: current > limit ? ttlSeconds : 0,
  };
}

function incrementLocalRateLimit(key, windowMs, limit, now) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${key}:${windowStart}`;
  const currentBucket = localRateLimitBuckets.get(bucketKey);
  const current = (currentBucket?.count || 0) + 1;
  localRateLimitBuckets.set(bucketKey, { count: current, expiresAt: windowStart + windowMs });

  if (localRateLimitBuckets.size > 10000) {
    for (const [storedKey, bucket] of localRateLimitBuckets) {
      if (bucket.expiresAt <= now) localRateLimitBuckets.delete(storedKey);
    }
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    retryAfterSeconds: current > limit ? Math.ceil((windowStart + windowMs - now) / 1000) : 0,
    degraded: true,
  };
}

function resolveCacheTTL(seconds) {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed)) return DEFAULT_CACHE_TTL_SECONDS;
  return Math.min(86400, Math.max(1, Math.floor(parsed)));
}

module.exports = {
  getCachedJson,
  setCachedJson,
  deleteCachedKey,
  deletePattern,
  incrementRateLimit,
  resolveCacheTTL,
  getCacheKey,
  isRedisEnabled,
};
