const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { redisRateLimit } = require("./middleware/distributedRateLimit");

const env = require("./config/env");
const { corsOptions } = require("./utils/cors");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const paymentController = require("./controllers/paymentController");
const prisma = require("./config/db");
const { getRedisClient, isRedisEnabled } = require("./config/redis");

const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const tableRoutes = require("./routes/tables");
const menuRoutes = require("./routes/menu");
const publicRoutes = require("./routes/public");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const couponRoutes = require("./routes/coupons");
const platformRoutes = require("./routes/platform");
const inventoryRoutes = require("./routes/inventory");
const subscriptionRoutes = require("./routes/subscriptions");
const subscriptionController = require("./controllers/subscriptionController");
const aiRoutes = require("./routes/ai");

const app = express();

app.set("trust proxy", 1);

// In production, redirect any plain-HTTP request to HTTPS. On hosts that
// already terminate TLS in front of this process (Railway, Render,
// Cloudflare) req.secure / x-forwarded-proto is already "https", so this
// never fires there — it only matters for a bare VPS deploy with nothing
// else enforcing HTTPS. Set FORCE_HTTPS=false to disable if you have a
// reason to (e.g. an internal health check over plain HTTP).
if (env.nodeEnv === "production" && env.forceHttps) {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// crossOriginResourcePolicy: helmet defaults to "same-origin", which would
// block the browser from rendering these images if the client were ever
// served from a different origin than the API.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(morgan((tokens, req, res) => JSON.stringify({
  method: tokens.method(req, res),
  status: Number(tokens.status(req, res)),
  durationMs: Number(tokens["response-time"](req, res)),
  requestId: req.requestId,
}), {
  skip: (req) => req.path === "/api/auth/google/callback",
}));

// Publicly served menu item / category images. Uploaded files get random
// UUID names (see middleware/upload.js) so nothing sensitive is exposed by
// making this public. Mounted early, well before the SPA catch-all below.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Global rate limiting; prefer a Redis-backed limiter in production so
// limits are shared across instances. Fall back to in-memory express-rate-limit
// for development/simple deployments.
if (env.nodeEnv === "production" && env.redisUrl) {
  app.use(redisRateLimit({ prefix: "global", windowMs: 15 * 60 * 1000, limit: 300, keyFn: (req) => req.ip }));
} else {
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
}

// Auth endpoints keep a stricter limit to blunt credential stuffing. In
// production prefer the Redis-based distributed limiter.
const authLimiter = env.redisUrl
  ? redisRateLimit({ prefix: "auth:global", windowMs: 15 * 60 * 1000, limit: 20, keyFn: (req) => req.ip })
  : rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Razorpay webhook needs the raw body for HMAC verification, so it's
// mounted BEFORE express.json() with its own raw parser.
// CORS is only needed for cross-origin API calls. Do not apply it globally: the
// React build and its /assets/* files are served by this same Express process,
// so a bad/missing ALLOWED_ORIGINS value must never make the production UI
// blank by rejecting its own JavaScript/CSS requests.
app.use("/api", cors(corsOptions()));

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentController.webhook);
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), subscriptionController.webhook);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.get("/health/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = getRedisClient();
    let cache = "disabled";
    if (isRedisEnabled()) {
      try {
        let timer;
        try {
          await Promise.race([
            redis.ping(),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("timeout")), env.redisOperationTimeoutMs);
              timer.unref?.();
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        cache = "ok";
      } catch {
        cache = "degraded";
      }
    }
    res.json({ status: "ok", database: "ok", cache, time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "not_ready", database: "error", time: new Date().toISOString() });
  }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api", menuRoutes); // /api/categories, /api/menu-items
app.use("/api/public", publicRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/platform", authLimiter, platformRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/ai", aiRoutes);

// ---- Serve the built React client from the same server/port -----------
// One process, one port: `npm start` builds the client (see root
// package.json) and this Express app serves the resulting static files
// directly, so there's no separate frontend server or CORS setup needed.
// The API still lives under /api/*, checked first above; everything else
// falls through to the SPA's index.html so client-side routing
// (react-router) works on a hard refresh/deep link too.
const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    setHeaders(res, filePath) {
      if (path.basename(filePath) === "index.html") {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else if (/-[A-Za-z0-9_-]{8,}\./.test(path.basename(filePath))) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    if (req.path === "/health") return next();
    if (req.path.startsWith("/uploads/")) return next();

    // Missing JS/CSS/image files must stay 404s. Returning index.html here
    // makes browsers parse HTML as JavaScript after deploys with stale HTML.
    if (req.path.startsWith("/assets/") || path.extname(req.path)) {
      return res.status(404).type("text/plain").send("Asset not found");
    }

    return res.sendFile(path.join(clientDistPath, "index.html"), {
      headers: { "Cache-Control": "no-cache, must-revalidate" },
    });
  });
} else {
  console.warn(
    `[server] client build not found at ${clientDistPath} — run "npm run build" ` +
      `(or "npm start" from the project root, which builds it automatically). ` +
      `API routes under /api are still active.`
  );
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
