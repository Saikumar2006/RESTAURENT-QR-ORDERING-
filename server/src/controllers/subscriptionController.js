const { ok, created, asyncHandler } = require("../utils/http");
const subscriptionCatalog = require("../services/subscriptionCatalog");
const subscriptionService = require("../services/subscriptionService");

const getPlans = (_req, res) => ok(res, subscriptionCatalog.getPublicCatalog());
const startTrial = asyncHandler(async (req, res) => created(res, await subscriptionService.startTrial(req.body)));
const createCheckout = asyncHandler(async (req, res) => created(res, await subscriptionService.createCheckout(req.body)));
const verifyCheckout = asyncHandler(async (req, res) => ok(res, await subscriptionService.verifyCheckout(req.body)));
const getCurrent = asyncHandler(async (req, res) => ok(res, await subscriptionService.getCurrentSubscription(req.user.restaurantId)));
const createRenewal = asyncHandler(async (req, res) => created(res, await subscriptionService.createRenewalCheckout(req.user.restaurantId, req.body.billingPeriod)));
const webhook = asyncHandler(async (req, res) => {
  const eventId = req.headers["x-razorpay-event-id"];
  const payload = JSON.parse(req.body.toString("utf8"));
  ok(res, await subscriptionService.handleWebhook(req.body, req.headers["x-razorpay-signature"], payload, eventId));
});

module.exports = { getPlans, startTrial, createCheckout, verifyCheckout, getCurrent, createRenewal, webhook };
