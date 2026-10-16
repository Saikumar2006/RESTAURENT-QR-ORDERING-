const { fail } = require("../utils/http");
const { ApiError } = require("../utils/http");

// Central error handler. Keeps internal error detail out of client responses
// (per NFR: never leak stack traces / internal messages) while logging the
// full error server-side for observability.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return fail(res, err.status, err.message, err.details);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify({
      event: "api_request_failed",
      version: require("../../package.json").version,
      timestamp: new Date().toISOString(),
      category: "internal",
      status: 500,
      requestId: req.requestId || "unknown",
    }));
  } else {
    console.error("API request failed", {
      name: err.name,
      code: err.code,
      method: req.method,
      requestId: req.requestId || "unknown",
      stack: err.stack,
    });
  }

  return fail(res, 500, "Something went wrong. Please try again.");
}

function notFoundHandler(req, res) {
  return fail(res, 404, "Resource not found");
}

module.exports = { errorHandler, notFoundHandler };
