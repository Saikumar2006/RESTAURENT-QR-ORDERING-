const env = require("../config/env");

// Requests with no Origin header (server-to-server calls, curl, the
// Razorpay webhook, same-origin single-process requests in some browsers)
// are allowed through — CORS only governs browser cross-origin requests.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = env.normalizeOrigin(origin);
  return env.allowedOrigins.includes(normalizedOrigin);
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
