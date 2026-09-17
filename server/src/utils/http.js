// Consistent JSON response envelope used by every endpoint.
function ok(res, data, meta) {
  return res.json({ success: true, data, meta: meta || undefined });
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function fail(res, status, message, details) {
  return res.status(status).json({
    success: false,
    error: { message, details: details || undefined },
  });
}

// Wraps an async route handler so thrown errors reach the error middleware
// instead of crashing the process or hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

module.exports = { ok, created, fail, asyncHandler, ApiError };
