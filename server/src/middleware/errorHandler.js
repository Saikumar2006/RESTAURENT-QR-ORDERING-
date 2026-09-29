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

  console.error(JSON.stringify({
    level: "error",
    msg: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  }));

  return fail(res, 500, "Something went wrong. Please try again.");
}

function notFoundHandler(req, res) {
  return fail(res, 404, "Resource not found");
}

module.exports = { errorHandler, notFoundHandler };
