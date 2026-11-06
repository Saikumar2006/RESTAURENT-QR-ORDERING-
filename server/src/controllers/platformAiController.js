const { ok, fail, asyncHandler } = require("../utils/http");
const aiGateway = require("../services/aiGateway");
const aiConversationService = require("../services/aiConversationService");
const prisma = require("../config/db");
const env = require("../config/env");

const getStatus = asyncHandler(async (req, res) => {
  const isConfigured = Boolean(env.aiApiKey) && env.aiProvider !== "unconfigured";
  return ok(res, {
    available: true,
    scope: "PLATFORM",
    provider: env.aiProvider || "mock",
    providerConfigured: isConfigured,
    model: "gpt-4o-mini",
    capabilities: [
      "macro_saas_metrics",
      "mrr_arr_forecasting",
      "churn_indicators",
      "payment_failure_diagnostics",
      "platform_system_health",
    ],
  });
});

const listConversations = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

  const result = await aiConversationService.listConversations({
    scope: "PLATFORM",
    platformAdminId: req.platformAdmin.id,
    limit,
    offset,
  });

  return ok(res, result);
});

const createConversation = asyncHandler(async (req, res) => {
  const { title, currentModule, language } = req.body || {};

  const conversation = await aiConversationService.createConversation({
    scope: "PLATFORM",
    platformAdminId: req.platformAdmin.id,
    title: title || "Platform Operations Chat",
    currentModule: currentModule || "platform_dashboard",
    language: language || "en",
  });

  return ok(res, { conversation });
});

const getConversation = asyncHandler(async (req, res) => {
  const conversation = await aiConversationService.getConversation(req.params.id, {
    scope: "PLATFORM",
    platformAdminId: req.platformAdmin.id,
  });

  return ok(res, { conversation });
});

const clearConversation = asyncHandler(async (req, res) => {
  await aiConversationService.clearConversation(req.params.id, {
    scope: "PLATFORM",
    platformAdminId: req.platformAdmin.id,
  });

  return ok(res, { cleared: true });
});

const deleteConversation = asyncHandler(async (req, res) => {
  await aiConversationService.deleteConversation(req.params.id, {
    scope: "PLATFORM",
    platformAdminId: req.platformAdmin.id,
  });

  return ok(res, { deleted: true });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, message, currentModule, language, context } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return fail(res, 400, "Message cannot be empty");
  }

  const result = await aiGateway.processChatMessage({
    conversationId,
    message,
    currentModule: currentModule || "platform_dashboard",
    language: language || "en",
    context: context || {},
    scope: "PLATFORM",
    platformAdmin: req.platformAdmin,
  });

  return ok(res, result);
});

const getTelemetry = asyncHandler(async (req, res) => {
  const [totalLogs, usageAggregation, recentLogs] = await Promise.all([
    prisma.aiUsageLog.count(),
    prisma.aiUsageLog.aggregate({
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        estimatedCostUsd: true,
      },
      _avg: {
        latencyMs: true,
      },
    }),
    prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        scope: true,
        model: true,
        totalTokens: true,
        latencyMs: true,
        success: true,
        createdAt: true,
      },
    }),
  ]);

  return ok(res, {
    totalRequests: totalLogs,
    totalTokens: usageAggregation._sum.totalTokens || 0,
    promptTokens: usageAggregation._sum.promptTokens || 0,
    completionTokens: usageAggregation._sum.completionTokens || 0,
    totalEstimatedCostUsd: Number((usageAggregation._sum.estimatedCostUsd || 0).toFixed(4)),
    averageLatencyMs: Math.round(usageAggregation._avg.latencyMs || 0),
    recentActivity: recentLogs,
  });
});

module.exports = {
  getStatus,
  listConversations,
  createConversation,
  getConversation,
  clearConversation,
  deleteConversation,
  sendMessage,
  getTelemetry,
};
