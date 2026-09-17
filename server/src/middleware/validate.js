const { fail } = require("../utils/http");

// Validates req.body against a Zod schema, replacing it with the parsed
// (and therefore type-coerced / defaulted) value on success.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return fail(res, 400, "Validation failed", result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
