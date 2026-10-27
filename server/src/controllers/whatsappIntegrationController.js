const { ok, asyncHandler, ApiError } = require("../utils/http");
const whatsappService = require("../services/whatsappService");

function assertOwnRestaurant(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
}

const getStatus = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, whatsappService.getConnectionStatus());
});

const testConnection = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await whatsappService.testConnection());
});

module.exports = { getStatus, testConnection };
