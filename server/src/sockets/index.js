const { Server } = require("socket.io");
const { verifyToken } = require("../utils/auth");
const { isAllowedOrigin } = require("../utils/cors");

let ioInstance = null;

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed. Add it to ALLOWED_ORIGINS.`));
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Staff/admin dashboards authenticate with their JWT and can only join
    // the room for their OWN restaurant — never an arbitrary restaurantId
    // supplied by the client.
    socket.on("restaurant:join", (token) => {
      try {
        const payload = verifyToken(token);
        socket.join(`restaurant:${payload.restaurantId}`);
        socket.emit("restaurant:joined", { restaurantId: payload.restaurantId });
      } catch {
        socket.emit("notification:error", { message: "Unauthorized socket connection" });
      }
    });

    // Guest customers join a narrow, non-privileged room scoped to the
    // specific order session token they were issued at checkout — they can
    // never see events for any order but their own.
    socket.on("order:join", (orderSessionToken) => {
      if (typeof orderSessionToken === "string" && orderSessionToken.length > 0) {
        socket.join(`order:${orderSessionToken}`);
      }
    });
  });

  ioInstance = io;
  return io;
}

function getIo() {
  if (!ioInstance) throw new Error("Socket.IO not initialized");
  return ioInstance;
}

// --- Emit helpers used by services after DB state is persisted -----------
// Persist-then-emit ordering is critical: the DB is always authoritative,
// sockets are a delivery mechanism, not a source of truth.

function emitNewOrder(restaurantId, orderSummary) {
  getIo().to(`restaurant:${restaurantId}`).emit("order:new", orderSummary);
}

function emitOrderUpdated(restaurantId, orderSummary) {
  getIo().to(`restaurant:${restaurantId}`).emit("order:updated", orderSummary);
}

function emitOrderStatus(orderSessionToken, statusPayload) {
  getIo().to(`order:${orderSessionToken}`).emit("order:status", statusPayload);
}

function emitPaymentUpdated(orderSessionToken, restaurantId, paymentPayload) {
  getIo().to(`order:${orderSessionToken}`).emit("payment:updated", paymentPayload);
  getIo().to(`restaurant:${restaurantId}`).emit("payment:updated", paymentPayload);
}

module.exports = {
  initSockets,
  getIo,
  emitNewOrder,
  emitOrderUpdated,
  emitOrderStatus,
  emitPaymentUpdated,
};
