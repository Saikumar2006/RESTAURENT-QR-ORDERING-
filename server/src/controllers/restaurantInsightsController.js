const { ok, asyncHandler, ApiError } = require("../utils/http");
const insightsService = require("../services/restaurantInsightsService");

function assertOwnRestaurant(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
}

const getAnalytics = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await insightsService.getAnalytics(req.user.restaurantId, req.query.days, { from: req.query.from, to: req.query.to }));
});

const getCustomers = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await insightsService.getCustomers(req.user.restaurantId));
});

const getTodayOperations = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await insightsService.getTodayOperations(req.user.restaurantId));
});

module.exports = { getAnalytics, getCustomers, getTodayOperations };
