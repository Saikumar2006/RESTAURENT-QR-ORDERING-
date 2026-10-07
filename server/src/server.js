const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { initSockets } = require("./sockets");
const { assertProductionSafety } = require("./startupChecks");
const { connectRedis, getRedisClient, isRedisEnabled } = require("./config/redis");

assertProductionSafety();

async function start() {
  if (isRedisEnabled()) {
    try {
      await connectRedis();
      console.log("Connected to Redis");
    } catch (err) {
      console.error("Failed to connect to Redis:", err.message);
    }
  }

  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`QR Ordering API listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`Payment provider: ${env.paymentProvider}`);
  });
}

start();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
