const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const { corsOptions } = require("./utils/cors");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const paymentController = require("./controllers/paymentController");

const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const tableRoutes = require("./routes/tables");
const menuRoutes = require("./routes/menu");
const publicRoutes = require("./routes/public");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const couponRoutes = require("./routes/coupons");
const platformRoutes = require("./routes/platform");

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
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined", {
  skip: (req) => req.originalUrl.startsWith("/api/auth/google/callback"),
}));

// Publicly served menu item / category images. Uploaded files get random
// UUID names (see middleware/upload.js) so nothing sensitive is exposed by
// making this public. Mounted early, well before the SPA catch-all below.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Global rate limiting; tighter limit specifically on auth to blunt brute force.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Razorpay webhook needs the raw body for HMAC verification, so it's
// mounted BEFORE express.json() with its own raw parser.
// CORS is only needed for cross-origin API calls. Do not apply it globally: the
// React build and its /assets/* files are served by this same Express process,
// so a bad/missing ALLOWED_ORIGINS value must never make the production UI
// blank by rejecting its own JavaScript/CSS requests.
app.use("/api", cors(corsOptions()));

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentController.webhook);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api", menuRoutes); // /api/categories, /api/menu-items
app.use("/api/public", publicRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/platform", authLimiter, platformRoutes);

// ---- Serve the built React client from the same server/port -----------
// One process, one port: `npm start` builds the client (see root
// package.json) and this Express app serves the resulting static files
// directly, so there's no separate frontend server or CORS setup needed.
// The API still lives under /api/*, checked first above; everything else
// falls through to the SPA's index.html so client-side routing
// (react-router) works on a hard refresh/deep link too.
const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    if (req.path === "/health") return next();
    if (req.path.startsWith("/uploads/")) return next();

    return res.sendFile(path.join(clientDistPath, "index.html"));
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
