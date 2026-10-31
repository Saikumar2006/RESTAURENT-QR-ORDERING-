const { ok, created, asyncHandler } = require("../utils/http");
const subscriptionCatalog = require("../services/subscriptionCatalog");
const subscriptionService = require("../services/subscriptionService");

const getPlans = (_req, res) => ok(res, subscriptionCatalog.getPublicCatalog());
const sendOtp = asyncHandler(async (req, res) => created(res, await subscriptionService.sendOnboardingOtp(req.body)));
const verifyOtp = asyncHandler(async (req, res) => ok(res, await subscriptionService.verifyOnboardingOtp(req.body)));
const startTrial = asyncHandler(async (req, res) => created(res, await subscriptionService.startTrial(req.body)));
const createCheckout = asyncHandler(async (req, res) => created(res, await subscriptionService.createCheckout(req.body)));
const verifyCheckout = asyncHandler(async (req, res) => ok(res, await subscriptionService.verifyCheckout(req.body)));
const getCurrent = asyncHandler(async (req, res) => ok(res, await subscriptionService.getCurrentSubscription(req.user.restaurantId)));
const createRenewal = asyncHandler(async (req, res) => created(res, await subscriptionService.createRenewalCheckout(req.user.restaurantId, req.body.billingPeriod)));
const upgrade = asyncHandler(async (req, res) => ok(res, await subscriptionService.upgradeSubscription(req.user.restaurantId, req.body)));
const getHistory = asyncHandler(async (req, res) => ok(res, await subscriptionService.getSubscriptionHistory(req.user.restaurantId)));
const webhook = asyncHandler(async (req, res) => {
  const eventId = req.headers["x-razorpay-event-id"];
  const payload = JSON.parse(req.body.toString("utf8"));
  ok(res, await subscriptionService.handleWebhook(req.body, req.headers["x-razorpay-signature"], payload, eventId));
});

module.exports = {
  getPlans,
  sendOtp,
  verifyOtp,
  startTrial,
  createCheckout,
  verifyCheckout,
  getCurrent,
  createRenewal,
  upgrade,
  getHistory,
  webhook,
};
