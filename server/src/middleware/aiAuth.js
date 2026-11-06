const { fail } = require("../utils/http");
const prisma = require("../config/db");

// In-memory sliding rate limit tracker: key -> [timestamps]
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 40;
const requestTimestamps = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const timestamps = requestTimestamps.get(key) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    requestTimestamps.set(key, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  requestTimestamps.set(key, validTimestamps);
  return true;
}

/**
 * Ensures authenticated restaurant user has active subscription or trial
 */
async function requireAiAccess(req, res, next) {
  if (!req.user || !req.user.restaurantId) {
    return fail(res, 401, "Authentication required for AI Assistant");
  }

  const restaurantId = req.user.restaurantId;

  // Rate limit by restaurant ID
  if (!checkRateLimit(`restaurant_${restaurantId}`)) {
    return fail(res, 429, "AI Assistant rate limit reached. Please wait a moment before sending more messages.");
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });

    if (subscription) {
      const now = new Date();
      const entitled = subscription.status === "GRANDFATHERED"
        || (subscription.status === "ACTIVE" && (!subscription.endsAt || subscription.endsAt > now))
        || (subscription.status === "TRIALING" && (!subscription.trialEndsAt || subscription.trialEndsAt > now))
        || (subscription.status === "PAST_DUE" && (!subscription.graceEndsAt || subscription.graceEndsAt > now));

      if (!entitled) {
        return fail(res, 402, "An active subscription or valid trial is required to use Svaadya AI Assistant.");
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Ensures authenticated platform admin can access platform AI
 */
function requirePlatformAiAccess(req, res, next) {
  if (!req.platformAdmin) {
    return fail(res, 401, "Platform Super Admin authentication required for Platform AI");
  }

  // Rate limit by platform admin ID
  if (!checkRateLimit(`platform_${req.platformAdmin.id}`)) {
    return fail(res, 429, "Platform AI query rate limit reached. Please wait a moment.");
  }

  next();
}

module.exports = {
  requireAiAccess,
  requirePlatformAiAccess,
};
