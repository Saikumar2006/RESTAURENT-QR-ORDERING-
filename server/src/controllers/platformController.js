const platformAuthService = require("../services/platformAuthService");
const platformService = require("../services/platformService");
const { ok, asyncHandler } = require("../utils/http");
const env = require("../config/env");
const jwt = require("jsonwebtoken");

const PLATFORM_SESSION_COOKIE = "svaadya_platform_session";
const platformCookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/platform",
  maxAge: 8 * 60 * 60 * 1000,
});

const login = asyncHandler(async (req, res) => {
  const result = await platformAuthService.login(req.body.email, req.body.password);
  const claims = jwt.decode(result.token);
  const maxAge = claims?.exp ? Math.max(0, claims.exp * 1000 - Date.now()) : 0;
  res.cookie(PLATFORM_SESSION_COOKIE, result.token, { ...platformCookieOptions(), maxAge });
  ok(res, { admin: result.admin });
});

const logout = asyncHandler(async (_req, res) => {
  const options = platformCookieOptions();
  delete options.maxAge;
  res.clearCookie(PLATFORM_SESSION_COOKIE, options);
  ok(res, { loggedOut: true });
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

module.exports = { login, logout, me, getOverview, listRestaurants };
