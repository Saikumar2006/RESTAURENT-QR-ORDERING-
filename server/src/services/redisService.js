const { getRedisClient, isRedisEnabled } = require("../config/redis");

const DEFAULT_CACHE_TTL_SECONDS = 300;

function getCacheKey(prefix, value) {
  return `${prefix}:${String(value)}`;
}

async function getCachedJson(key) {
  const redis = getRedisClient();
  if (!redis) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCachedJson(key, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const redis = getRedisClient();
  if (!redis) return false;
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  return true;
}

async function deleteCachedKey(key) {
  const redis = getRedisClient();
  if (!redis) return false;
  await redis.del(key);
  return true;
}

async function deletePattern(pattern) {
  const redis = getRedisClient();
  if (!redis) return false;
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return true;
  await redis.del(keys);
  return true;
}

async function incrementRateLimit(key, windowMs, limit) {
  const redis = getRedisClient();
  if (!redis) return { allowed: true, remaining: limit };

  const now = Date.now();
  const ttlSeconds = Math.ceil(windowMs / 1000);
  const bucket = `${key}:${Math.floor(now / windowMs)}`;
  const current = await redis.incr(bucket);
  if (current === 1) {
    await redis.expire(bucket, ttlSeconds);
  }

  const remaining = Math.max(0, limit - current);
  return {
    allowed: current <= limit,
    remaining,
    retryAfterSeconds: current > limit ? ttlSeconds : 0,
  };
}

function resolveCacheTTL(seconds) {
  return Math.max(1, Number(seconds) || DEFAULT_CACHE_TTL_SECONDS);
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
