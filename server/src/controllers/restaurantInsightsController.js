const { ok, asyncHandler, ApiError } = require("../utils/http");
const insightsService = require("../services/restaurantInsightsService");

function assertOwnRestaurant(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
}

const getAnalytics = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await insightsService.getAnalytics(req.user.restaurantId, req.query.days));
});

const getCustomers = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await insightsService.getCustomers(req.user.restaurantId));
});

module.exports = { getAnalytics, getCustomers };