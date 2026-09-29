const env = require("../config/env");

// Requests with no Origin header (server-to-server calls, curl, the
// Razorpay webhook, same-origin single-process requests in some browsers)
// are allowed through — CORS only governs browser cross-origin requests.
function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalized = origin.toLowerCase();
  if (env.allowedOrigins.includes(normalized)) return true;

  // Vite and other local dev servers often pick a port like 5177, 5178,
  // etc. when 5173 is already occupied. Accept localhost / 127.0.0.1 in
  // development without needing a manual ALLOWED_ORIGINS edit each time.
  if (env.nodeEnv === "development") {
    return /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
  }

  return false;
}

function corsOptions() {
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed. Add it to ALLOWED_ORIGINS.`));
    },
    credentials: true,
  };
}

module.exports = { isAllowedOrigin, corsOptions };
