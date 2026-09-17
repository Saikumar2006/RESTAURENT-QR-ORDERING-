const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { initSockets } = require("./sockets");
const { assertProductionSafety } = require("./startupChecks");

assertProductionSafety();

const server = http.createServer(app);
initSockets(server);

server.listen(env.port, () => {
  console.log(`QR Ordering API listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`Payment provider: ${env.paymentProvider}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
