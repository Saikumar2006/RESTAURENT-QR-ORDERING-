const platformAuthService = require("../services/platformAuthService");
const platformService = require("../services/platformService");
const { ok, created, asyncHandler } = require("../utils/http");
const env = require("../config/env");
const jwt = require("jsonwebtoken");
const platformRoleService = require("../services/platformRoleService");
const platformRestaurantService = require("../services/platformRestaurantService");

const PLATFORM_SESSION_COOKIE = "svaadya_platform_session";
const platformCookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/platform",
  maxAge: 8 * 60 * 60 * 1000,
});

const login = asyncHandler(async (req, res) => {
  const result = await platformAuthService.login(req.body.email, req.body.password, req.requestId);
  if (result.accountType === "platform") {
    const claims = jwt.decode(result.token);
    const maxAge = claims?.exp ? Math.max(0, claims.exp * 1000 - Date.now()) : 0;
    res.cookie(PLATFORM_SESSION_COOKIE, result.token, { ...platformCookieOptions(), maxAge });
    ok(res, {
      accountType: "platform",
      admin: result.admin,
      redirectTo: "/super-admin/dashboard",
    });
    return;
  }
  // Tenant user (Owner / Staff)
  ok(res, {
    accountType: "tenant",
    token: result.token,
    user: result.user,
    redirectTo: result.redirectTo || "/admin",
  });
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
  if (!req.platformAdmin.permissions.includes("platform.finance.view")) {
    delete stats.totalRevenue;
    delete stats.revenueToday;
  }
  if (!req.platformAdmin.permissions.includes("platform.restaurants.view")) {
    delete stats.totalRestaurants;
    delete stats.activeRestaurants;
    delete stats.suspendedRestaurants;
    delete stats.openNowCount;
    delete stats.closedNowCount;
    delete stats.totalUsers;
    delete stats.usersByRole;
    delete stats.totalOrders;
    delete stats.ordersToday;
    delete stats.restaurantsByCuisine;
  }
  ok(res, stats);
});

const listRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await platformService.listRestaurants();
  ok(res, restaurants);
});

const createRestaurant = asyncHandler(async (req, res) => {
  created(res, await platformRestaurantService.createRestaurant(req.body, req.platformAdmin.id));
});

const issueOwnerInvitation = asyncHandler(async (req, res) => {
  created(res, await platformRestaurantService.issueOwnerInvitation(req.params.id, req.body.reason, req.platformAdmin.id));
});

const getRestaurantInvitation = asyncHandler(async (req, res) => {
  ok(res, await platformRestaurantService.getInvitation(req.params.token));
});

const activateRestaurantInvitation = asyncHandler(async (req, res) => {
  ok(res, await platformRestaurantService.activateInvitation(req.params.token, req.body.password));
});

const listAdmins = asyncHandler(async (_req, res) => {
  ok(res, await platformRoleService.listPlatformAdmins());
});

const updateAdminRole = asyncHandler(async (req, res) => {
  const superAdminEmails = platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails);
  ok(res, await platformRoleService.updatePlatformRole(req.platformAdmin.id, req.params.id, req.body.platformRole, undefined, superAdminEmails));
});

const listAudit = asyncHandler(async (req, res) => {
  ok(res, await platformRoleService.listPlatformAudit(undefined, req.query.limit));
});

module.exports = { login, logout, me, getOverview, listRestaurants, createRestaurant, issueOwnerInvitation, getRestaurantInvitation, activateRestaurantInvitation, listAdmins, updateAdminRole, listAudit };
