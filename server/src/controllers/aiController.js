const { ok, fail, asyncHandler } = require("../utils/http");
const aiGateway = require("../services/aiGateway");
const aiConversationService = require("../services/aiConversationService");
const aiApprovalService = require("../services/aiApprovalService");
const { forecastInventoryDemand } = require("../services/aiForecastService");
const { getUpcomingFestivals, analyzeEventDemand } = require("../services/festivalDemandEngine");
const env = require("../config/env");

/**
 * AI Assistant Status Check
 */
const getAiStatus = asyncHandler(async (req, res) => {
  const isConfigured = Boolean(env.aiApiKey) && env.aiProvider !== "unconfigured";
  return ok(res, {
    available: true,
    provider: env.aiProvider || "mock",
    providerConfigured: isConfigured,
    model: "gpt-4o-mini",
    features: [
      "live_sales_analytics",
      "deterministic_inventory_forecasting",
      "festival_demand_intelligence",
      "two_step_action_proposals",
      "multilingual_11_languages",
    ],
  });
});

/**
 * Backwards compatibility for legacy menu-assist check
 */
const menuAssistStatus = asyncHandler(async (req, res) => {
  return ok(res, {
    premiumPlan: true,
    providerConfigured: true,
    available: true,
    reason: null,
  });
});

/**
 * List Conversations for current restaurant user
 */
const listConversations = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

  const result = await aiConversationService.listConversations({
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
    userId: req.user.id,
    limit,
    offset,
  });

  return ok(res, result);
});

/**
 * Create a new conversation
 */
const createConversation = asyncHandler(async (req, res) => {
  const { title, currentModule, language } = req.body || {};

  const conversation = await aiConversationService.createConversation({
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
    userId: req.user.id,
    title: title || "New Conversation",
    currentModule: currentModule || "overview",
    language: language || req.user.preferredLanguage || "en",
  });

  return ok(res, { conversation });
});

/**
 * Get Conversation details with messages
 */
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await aiConversationService.getConversation(req.params.id, {
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
  });

  return ok(res, { conversation });
});

/**
 * Clear conversation messages
 */
const clearConversation = asyncHandler(async (req, res) => {
  await aiConversationService.clearConversation(req.params.id, {
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
  });

  return ok(res, { cleared: true });
});

/**
 * Delete conversation
 */
const deleteConversation = asyncHandler(async (req, res) => {
  await aiConversationService.deleteConversation(req.params.id, {
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
  });

  return ok(res, { deleted: true });
});

/**
 * Send a chat message to Svaadya AI Assistant
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, message, currentModule, language, context } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return fail(res, 400, "Message cannot be empty");
  }

  const result = await aiGateway.processChatMessage({
    conversationId,
    message,
    currentModule: currentModule || "overview",
    language: language || req.user.preferredLanguage || "en",
    context: context || {},
    scope: "RESTAURANT",
    restaurantId: req.user.restaurantId,
    user: req.user,
  });

  return ok(res, result);
});

/**
 * List Action Proposals for restaurant
 */
const listProposals = asyncHandler(async (req, res) => {
  const { status, conversationId } = req.query;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

  const proposals = await aiApprovalService.listProposals({
    restaurantId: req.user.restaurantId,
    status,
    conversationId,
    limit,
    offset,
  });

  return ok(res, proposals);
});

/**
 * Execute an approved action proposal
 */
const executeProposal = asyncHandler(async (req, res) => {
  const result = await aiApprovalService.executeProposal(req.params.id, {
    restaurantId: req.user.restaurantId,
    userId: req.user.id,
    isOwner: req.user.isOwner,
  });

  return ok(res, result);
});

/**
 * Reject an action proposal
 */
const rejectProposal = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const updated = await aiApprovalService.rejectProposal(req.params.id, {
    restaurantId: req.user.restaurantId,
    userId: req.user.id,
    reason,
  });

  return ok(res, { proposal: updated });
});

/**
 * Direct inventory demand forecast query
 */
const getInventoryForecast = asyncHandler(async (req, res) => {
  const horizonDays = req.query.horizonDays ? parseInt(req.query.horizonDays, 10) : 7;
  const itemId = req.query.itemId || null;

  const forecast = await forecastInventoryDemand(req.user.restaurantId, {
    itemId,
    horizonDays,
  });

  return ok(res, forecast);
});

/**
 * Direct upcoming festivals & demand query
 */
const getUpcomingFestivalDemand = asyncHandler(async (req, res) => {
  const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead, 10) : 30;
  const festivalId = req.query.festivalId || null;

  if (festivalId) {
    const analysis = await analyzeEventDemand(req.user.restaurantId, festivalId);
    return ok(res, analysis);
  }

  const festivals = getUpcomingFestivals(daysAhead);
  return ok(res, { festivals, daysAhead });
});

module.exports = {
  getAiStatus,
  menuAssistStatus,
  listConversations,
  createConversation,
  getConversation,
  clearConversation,
  deleteConversation,
  sendMessage,
  listProposals,
  executeProposal,
  rejectProposal,
  getInventoryForecast,
  getUpcomingFestivalDemand,
};
