const { ok, asyncHandler, ApiError } = require("../utils/http");
const twilioService = require("../services/twilioService");
const whatsappService = require("../services/whatsappService");
const communicationsService = require("../services/communicationsService");
const prisma = require("../config/db");
const env = require("../config/env");

const getStatus = asyncHandler(async (req, res) => {
  const twilio = twilioService.getConnectionStatus();
  const meta = whatsappService.getConnectionStatus();

  ok(res, {
    twilio,
    meta,
    messagingProvider: env.messagingProvider,
    whatsappProvider: env.whatsappProvider,
  });
});

const testTwilioConnection = asyncHandler(async (req, res) => {
  const result = await twilioService.testConnection();
  ok(res, result);
});

const sendTestMessage = asyncHandler(async (req, res) => {
  const { phone, channel = "sms", message } = req.body;
  if (!phone || typeof phone !== "string") {
    throw new ApiError(400, "Phone number is required.");
  }

  const result = await communicationsService.dispatchMessage({
    phone,
    purpose: "test_message",
    customBody: message || `Svaadya Communications Test: Delivery confirmed on ${channel.toUpperCase()} at ${new Date().toLocaleTimeString()}`,
    preferredChannel: channel,
    allowFallback: false,
  });

  if (!result.success) {
    throw new ApiError(502, result.error || "Test dispatch failed.");
  }

  ok(res, result);
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await communicationsService.getCommunicationStats();
  ok(res, stats);
});

const listTemplates = asyncHandler(async (req, res) => {
  const dbTemplates = await prisma.communicationTemplate.findMany();
  const dbMap = new Map(dbTemplates.map((t) => [t.key, t]));

  const merged = Object.values(communicationsService.DEFAULT_TEMPLATES).map((def) => {
    const custom = dbMap.get(def.key);
    return custom || def;
  });

  ok(res, merged);
});

const updateTemplate = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { title, body, channel = "both", isActive = true } = req.body;

  if (!body || typeof body !== "string" || body.trim().length < 5) {
    throw new ApiError(400, "Template body must be at least 5 characters.");
  }

  const updated = await prisma.communicationTemplate.upsert({
    where: { key },
    create: {
      key,
      title: title || key,
      body: body.trim(),
      channel,
      isActive: Boolean(isActive),
    },
    update: {
      title: title || undefined,
      body: body.trim(),
      channel,
      isActive: Boolean(isActive),
    },
  });

  ok(res, updated);
});

const listLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

  const { channel, purpose, status, search } = req.query;

  const where = {};
  if (channel && channel !== "ALL") where.channel = channel;
  if (purpose && purpose !== "ALL") where.purpose = purpose;
  if (status && status !== "ALL") where.status = status;
  if (search && typeof search === "string" && search.trim()) {
    where.phone = { contains: search.trim() };
  }

  const [total, items] = await Promise.all([
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const sanitizedItems = items.map((item) => ({
    ...item,
    phoneMasked: twilioService.maskPhone(item.phone),
  }));

  ok(res, {
    items: sanitizedItems,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * Inbound Twilio StatusCallback webhook.
 * Validates Twilio signature when AUTH_TOKEN is configured.
 */
const twilioStatusWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-twilio-signature"];
  const fullUrl = `${env.serverUrl || "https://restaurent-qr-ordering.onrender.com"}${req.originalUrl}`;

  // If in production and auth token is set, validate signature
  if (env.nodeEnv === "production" && env.twilioAuthToken) {
    const isValid = twilioService.validateTwilioSignature(signature, fullUrl, req.body);
    if (!isValid) {
      console.warn("Rejected invalid Twilio webhook signature");
      return res.status(403).send("Forbidden: Invalid Twilio signature");
    }
  }

  const result = await communicationsService.processTwilioStatusCallback(req.body);
  res.type("text/xml").send("<Response></Response>");
});

module.exports = {
  getStatus,
  testTwilioConnection,
  sendTestMessage,
  getStats,
  listTemplates,
  updateTemplate,
  listLogs,
  twilioStatusWebhook,
};
