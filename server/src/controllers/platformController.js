const platformAuthService = require("../services/platformAuthService");
const platformService = require("../services/platformService");
const platformControlService = require("../services/platformControlService");
const { ok, created, asyncHandler } = require("../utils/http");
const env = require("../config/env");
const jwt = require("jsonwebtoken");
const platformRoleService = require("../services/platformRoleService");
const platformRestaurantService = require("../services/platformRestaurantService");
const subscriptionCatalog = require("../services/subscriptionCatalog");
const subscriptionService = require("../services/subscriptionService");

const PLATFORM_SESSION_COOKIE = "svaadya_platform_session";
const platformCookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/platform",
  maxAge: 8 * 60 * 60 * 1000,
});

const login = asyncHandler(async (req, res) => {
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip;
  const result = await platformAuthService.login(req.body.email, req.body.password, req.requestId, clientIp);
  if (result.accountType === "platform") {
    const claims = jwt.decode(result.token);
    const maxAge = claims?.exp ? Math.max(0, claims.exp * 1000 - Date.now()) : 0;
    res.cookie(PLATFORM_SESSION_COOKIE, result.token, { ...platformCookieOptions(), maxAge });
    ok(res, {
      accountType: "platform",
      token: result.token,
      admin: result.admin,
      redirectTo: "/super-admin/dashboard",
    });
    return;
  }
  // Fallback for non-platform user
  ok(res, {
    accountType: "tenant",
    token: result.token,
    user: result.user,
    redirectTo: result.redirectTo || "/admin",
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await platformAuthService.changeAdminPassword(req.platformAdmin.id, req.body.currentPassword, req.body.newPassword);
  ok(res, result);
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
    delete stats.monthlyRecurringRevenue;
    delete stats.subscriptionRevenue;
    delete stats.subscriptionRevenueMonth;
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
    delete stats.pendingOnboardings;
    delete stats.activeSubscriptions;
    delete stats.trialingSubscriptions;
    delete stats.planDistribution;
    delete stats.restaurantRegistrations;
    delete stats.subscriptionRegistrations;
  }
  if (!req.platformAdmin.permissions.includes("platform.admins.manage")) delete stats.totalPlatformUsers;
  ok(res, stats);
});

const listRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await platformService.listRestaurants();
  ok(res, restaurants);
});

const getRestaurantDetail = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.getRestaurantDetail(req.params.id));
});

const updateRestaurantStatus = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.updateRestaurantStatus(req.params.id, req.body.status, req.body.reason, req.platformAdmin.id));
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

// Users management (cross-tenant)
const listUsers = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.listCrossTenantUsers({
    search: req.query.search,
    role: req.query.role,
    restaurantId: req.query.restaurantId,
    page: req.query.page,
    limit: req.query.limit,
  }));
});

const toggleUserStatus = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.toggleTenantUserStatus(req.params.id, req.body.isActive, req.platformAdmin.id));
});

// Transactions & Billing
const listTransactions = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.listTransactions({
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  }));
});

// Support Tickets
const listSupportTickets = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.listSupportTickets({
    status: req.query.status,
    priority: req.query.priority,
    page: req.query.page,
    limit: req.query.limit,
  }));
});

const createSupportTicket = asyncHandler(async (req, res) => {
  created(res, await platformControlService.createSupportTicket(req.body, req.platformAdmin.id));
});

const updateSupportTicket = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.updateSupportTicket(req.params.id, req.body, req.platformAdmin.id));
});

// System Health & Integrations
const getSystemHealth = asyncHandler(async (_req, res) => {
  ok(res, await platformControlService.getSystemHealth());
});

// Platform Settings
const getPlatformSettings = asyncHandler(async (_req, res) => {
  ok(res, await platformControlService.getPlatformSettings());
});

const updatePlatformSetting = asyncHandler(async (req, res) => {
  ok(res, await platformControlService.updatePlatformSetting(req.body.key, req.body.value, req.body.category, req.body.description, req.platformAdmin.id));
});

// Onboarding Funnel
const getOnboardingFunnel = asyncHandler(async (_req, res) => {
  ok(res, await platformControlService.getOnboardingFunnel());
});

// Subscription & Package Management for Super Admin
const getPackages = asyncHandler(async (_req, res) => {
  ok(res, subscriptionCatalog.getPublicCatalog());
});

const updatePackages = asyncHandler(async (req, res) => {
  const updated = subscriptionCatalog.updateDynamicPricing(req.body.prices || req.body);
  ok(res, updated);
});

const listSubscriptions = asyncHandler(async (_req, res) => {
  const subscriptions = await subscriptionService.listAllSubscriptionsForAdmin();
  ok(res, subscriptions);
});

const listPendingOnboardings = asyncHandler(async (_req, res) => {
  const pending = await subscriptionService.listPendingOnboardingsForAdmin();
  ok(res, pending);
});

module.exports = {
  login,
  changePassword,
  logout,
  me,
  getOverview,
  listRestaurants,
  getRestaurantDetail,
  updateRestaurantStatus,
  createRestaurant,
  issueOwnerInvitation,
  getRestaurantInvitation,
  activateRestaurantInvitation,
  listAdmins,
  updateAdminRole,
  listAudit,
  listUsers,
  toggleUserStatus,
  listTransactions,
  listSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  getSystemHealth,
  getPlatformSettings,
  updatePlatformSetting,
  getOnboardingFunnel,
  getPackages,
  updatePackages,
  listSubscriptions,
  listPendingOnboardings,
};
