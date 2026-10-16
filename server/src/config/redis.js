const { createClient } = require("redis");
const env = require("./env");

let client = null;

function getRedisClient() {
  if (!env.redisUrl) return null;
  if (!client) {
    client = createClient({
      url: env.redisUrl,
      socket: {
        connectTimeout: env.redisConnectTimeoutMs,
        ...(env.redisTlsEnabled ? { tls: true } : {}),
      },
    });
    client.on("error", () => {
      console.error(JSON.stringify({
        event: "dependency_error",
        category: "redis",
        timestamp: new Date().toISOString(),
      }));
    });
    // do not connect automatically here; caller should call connectRedis
  }
  return client;
}

async function connectRedis() {
  const redis = getRedisClient();
  if (!redis) return null;
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

function isRedisEnabled() {
  return Boolean(env.redisUrl);
}

module.exports = { getRedisClient, connectRedis, isRedisEnabled };
