const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { initSockets } = require("./sockets");
const { assertProductionSafety } = require("./startupChecks");
const { connectRedis, getRedisClient, isRedisEnabled } = require("./config/redis");
const { expireSubscriptions } = require("./services/subscriptionService");

assertProductionSafety();

async function start() {
  if (isRedisEnabled()) {
    try {
      await connectRedis();
      console.log("Connected to Redis");
    } catch (err) {
      if (env.nodeEnv === "production") {
        console.error(JSON.stringify({
          event: "dependency_connection_failed",
          version: require("../package.json").version,
          timestamp: new Date().toISOString(),
          category: "redis",
        }));
      } else {
        console.error("Failed to connect to Redis:", err);
      }
    }
  }

  const server = http.createServer(app);
  await initSockets(server);

  server.listen(env.port, () => {
    console.log(`QR Ordering API listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`Payment provider: ${env.paymentProvider}`);
    const subscriptionSweep = setInterval(() => {
      expireSubscriptions().catch(() => {
        console.error(JSON.stringify({ event: "subscription_expiry_sweep_failed", category: "billing_lifecycle", timestamp: new Date().toISOString() }));
      });
    }, 5 * 60 * 1000);
    subscriptionSweep.unref?.();
  });
}

start();

process.on("unhandledRejection", (reason) => {
  if (env.nodeEnv === "production") {
    console.error(JSON.stringify({
      event: "unhandled_rejection",
      version: require("../package.json").version,
      timestamp: new Date().toISOString(),
      category: "process",
    }));
  } else {
    console.error("Unhandled rejection:", reason);
  }
});
