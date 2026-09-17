const platformAuthService = require("../services/platformAuthService");
const platformService = require("../services/platformService");
const { ok, asyncHandler } = require("../utils/http");

const login = asyncHandler(async (req, res) => {
  const result = await platformAuthService.login(req.body.email, req.body.password);
  ok(res, result);
});

const me = asyncHandler(async (req, res) => {
  ok(res, req.platformAdmin);
});

const getOverview = asyncHandler(async (req, res) => {
  const stats = await platformService.getOverview();
  ok(res, stats);
});

const listRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await platformService.listRestaurants();
  ok(res, restaurants);
});

module.exports = { login, me, getOverview, listRestaurants };
