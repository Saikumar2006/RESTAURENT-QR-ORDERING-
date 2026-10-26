const { ok, asyncHandler, ApiError } = require("../utils/http");
const { getTestFixture } = require("../services/orderProviders");
const env = require("../config/env");

const getTestFixtureForRestaurant = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  if (env.nodeEnv === "production") throw new ApiError(404, "Test fixtures are disabled in production");
  ok(res, getTestFixture(req.params.provider));
});

module.exports = { getTestFixtureForRestaurant };
