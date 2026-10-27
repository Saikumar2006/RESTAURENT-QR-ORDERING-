const aiMenuAssistService = require("../services/aiMenuAssistService");
const { ok, asyncHandler } = require("../utils/http");

const menuAssistStatus = asyncHandler(async (req, res) => ok(res, await aiMenuAssistService.getStatus(req.user.restaurantId)));

module.exports = { menuAssistStatus };
