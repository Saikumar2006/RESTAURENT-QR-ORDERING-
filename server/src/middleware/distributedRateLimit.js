const { incrementRateLimit, getCacheKey } = require("../services/redisService");
const { fail } = require("../utils/http");

// Options: { prefix, windowMs, limit, keyFn }
function redisRateLimit(opts) {
  if (!opts || !opts.prefix || !opts.windowMs || !opts.limit) throw new Error("Missing options for redisRateLimit");

  return async (req, res, next) => {
    try {
      const keyBase = opts.keyFn ? await opts.keyFn(req) : req.ip;
      const key = getCacheKey(opts.prefix, keyBase);
      const result = await incrementRateLimit(key, opts.windowMs, opts.limit);
      res.setHeader("X-RateLimit-Limit", String(opts.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        return fail(res, 429, "Rate limit exceeded. Try again later.");
      }
      next();
    } catch (err) {
      // Fail open on Redis errors — don't block legitimate traffic if
      // Redis is temporarily unavailable. Log and continue.
      console.error("Rate limiter error:", err.message);
      return next();
    }
  };
}

module.exports = { redisRateLimit };
