const crypto = require("crypto");
const env = require("../config/env");
const prisma = require("../config/db");
const twilioService = require("./twilioService");
const whatsappService = require("./whatsappService");
const { ApiError } = require("../utils/http");

// --- Default Templates Registry ---------------------------------------------
const DEFAULT_TEMPLATES = {
  OTP_VERIFICATION: {
    key: "OTP_VERIFICATION",
    channel: "both",
    title: "OTP Verification",
    body: "Your Svaadya verification code is: {{code}}. Valid for 5 minutes. Do not share this code.",
  },
  ORDER_CONFIRMATION: {
    key: "ORDER_CONFIRMATION",
    channel: "both",
    title: "Customer Order Confirmation",
    body: "{{restaurantName}}: Order #{{orderNumber}} confirmed! {{itemsSummary}}. Total ₹{{totalAmount}}. Track: {{trackingUrl}}",
  },
  ORDER_STATUS_UPDATE: {
    key: "ORDER_STATUS_UPDATE",
    channel: "both",
    title: "Order Status Update",
    body: "{{restaurantName}}: Order #{{orderNumber}} is {{status}}! {{customMessage}}",
  },
  OWNER_NEW_ORDER: {
    key: "OWNER_NEW_ORDER",
    channel: "both",
    title: "Restaurant Owner Order Alert",
    body: "🔔 New Order #{{orderNumber}} at {{restaurantName}}! Table {{tableNumber}} | Total ₹{{totalAmount}} | Items: {{itemsSummary}}",
  },
  STAFF_INVITATION: {
    key: "STAFF_INVITATION",
    channel: "both",
    title: "Staff Team Invitation",
    body: "You have been invited to join {{restaurantName}} on Svaadya. Complete your account setup: {{setupUrl}}",
  },
  STAFF_PASSWORD_RESET: {
    key: "STAFF_PASSWORD_RESET",
    channel: "both",
    title: "Staff Password Reset",
    body: "Password reset requested for your {{restaurantName}} account. Reset here: {{resetUrl}}",
  },
  SUBSCRIPTION_SUCCESS: {
    key: "SUBSCRIPTION_SUCCESS",
    channel: "both",
    title: "Subscription Renewal Confirmed",
    body: "Svaadya: Payment of ₹{{amount}} for {{planName}} plan confirmed. Active until {{endsAt}}.",
  },
  SUBSCRIPTION_FAILED: {
    key: "SUBSCRIPTION_FAILED",
    channel: "both",
    title: "Subscription Renewal Alert",
    body: "Svaadya: Renewal payment for {{restaurantName}} could not be processed. Grace period ends on {{graceEndsAt}}.",
  },
};

function renderTemplate(templateString, variables = {}) {
  if (!templateString) return "";
  return templateString.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : "";
  });
}

async function getTemplate(key) {
  try {
    const dbTemplate = await prisma.communicationTemplate.findUnique({ where: { key } });
    if (dbTemplate && dbTemplate.isActive) {
      return dbTemplate;
    }
  } catch {
    // If DB is temporarily unavailable or table not created yet, fall back to code default
  }
  return DEFAULT_TEMPLATES[key] || null;
}

function normalizePhoneNumber(phone) {
  if (typeof phone !== "string") return null;
  const digits = phone.trim().replace(/[^\d+]/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function generateIdempotencyKey(purpose, entityId, channel, phone) {
  const seed = `${purpose}:${entityId || ""}:${channel}:${phone}`;
  return crypto.createHash("sha256").update(seed).digest("hex");
}

async function logNotificationAttempt({
  restaurantId = null,
  orderId = null,
  phone,
  channel,
  purpose,
  status,
  provider = "twilio",
  providerRef = null,
  idempotencyKey = null,
  errorCode = null,
  errorMessage = null,
}) {
  try {
    return await prisma.notificationLog.create({
      data: {
        restaurantId,
        orderId,
        phone,
        channel,
        purpose,
        status,
        provider,
        providerRef,
        idempotencyKey,
        errorCode,
        errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write NotificationLog:", err.message);
    return null;
  }
}

/**
 * Core dispatch function with:
 * - Template hydration
 * - Idempotency deduplication
 * - Multi-channel fallback
 * - Provider routing (Twilio, Meta, Mock)
 */
async function dispatchMessage({
  restaurantId = null,
  orderId = null,
  phone,
  purpose,
  templateKey = null,
  templateData = {},
  customBody = null,
  preferredChannel = "whatsapp",
  allowFallback = true,
  idempotencyKey = null,
}) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Invalid phone number format. International format required (+[country][digits])." };
  }

  // Idempotency Deduplication Check
  const effectiveIdempotencyKey = idempotencyKey || (orderId ? generateIdempotencyKey(purpose, orderId, preferredChannel, normalizedPhone) : null);
  if (effectiveIdempotencyKey) {
    try {
      const existing = await prisma.notificationLog.findUnique({
        where: { idempotencyKey: effectiveIdempotencyKey },
      });
      if (existing && existing.status !== "failed") {
        return {
          success: true,
          deduplicated: true,
          providerRef: existing.providerRef,
          channel: existing.channel,
          status: existing.status,
        };
      }
    } catch {
      // Continue if DB lookup fails
    }
  }

  // Message body resolution
  let messageBody = customBody;
  if (!messageBody && templateKey) {
    const tpl = await getTemplate(templateKey);
    if (tpl) {
      messageBody = renderTemplate(tpl.body, templateData);
    }
  }

  if (!messageBody) {
    messageBody = customBody || `Notification from Svaadya: ${purpose}`;
  }

  // Determine channels to attempt
  const channelsToTry = [];
  if (preferredChannel === "sms") {
    channelsToTry.push("sms");
    if (allowFallback) channelsToTry.push("whatsapp");
  } else {
    channelsToTry.push("whatsapp");
    if (allowFallback) channelsToTry.push("sms");
  }

  // Check Mock Provider in local dev
  const isMock = env.messagingProvider === "mock" && env.nodeEnv !== "production";
  if (isMock) {
    console.log(JSON.stringify({
      event: "mock_communication_sent",
      to: normalizedPhone,
      channels: channelsToTry,
      purpose,
      body: messageBody,
    }));
    const mockRef = `mock_${Date.now()}`;
    await logNotificationAttempt({
      restaurantId,
      orderId,
      phone: normalizedPhone,
      channel: channelsToTry[0],
      purpose,
      status: "delivered",
      provider: "mock",
      providerRef: mockRef,
      idempotencyKey: effectiveIdempotencyKey,
    });
    return { success: true, channel: channelsToTry[0], providerRef: mockRef, provider: "mock" };
  }

  let lastError = null;
  const statusCallbackUrl = env.serverUrl ? `${env.serverUrl}/api/communications/twilio/webhook/status` : null;

  for (const channel of channelsToTry) {
    try {
      if (channel === "whatsapp") {
        // WhatsApp provider selection
        const useMeta = env.whatsappProvider === "meta" ||
          (env.whatsappProvider === "auto" && Boolean(env.whatsappAccessToken) && !twilioService.isWhatsappConfigured());

        if (useMeta && purpose === "otp" && templateData.code) {
          // Meta WhatsApp Cloud API for approved OTP template
          await whatsappService.sendWhatsAppOtp(normalizedPhone, String(templateData.code));
          await logNotificationAttempt({
            restaurantId,
            orderId,
            phone: normalizedPhone,
            channel: "whatsapp",
            purpose,
            status: "sent",
            provider: "meta",
            idempotencyKey: effectiveIdempotencyKey,
          });
          return { success: true, channel: "whatsapp", provider: "meta" };
        } else if (twilioService.isWhatsappConfigured()) {
          // Twilio WhatsApp
          const result = await twilioService.sendTwilioMessage({
            to: normalizedPhone,
            body: messageBody,
            channel: "whatsapp",
            statusCallbackUrl,
          });
          await logNotificationAttempt({
            restaurantId,
            orderId,
            phone: normalizedPhone,
            channel: "whatsapp",
            purpose,
            status: result.status || "queued",
            provider: "twilio",
            providerRef: result.providerRef,
            idempotencyKey: effectiveIdempotencyKey,
          });
          return { success: true, channel: "whatsapp", providerRef: result.providerRef, provider: "twilio" };
        } else {
          throw new Error("WhatsApp is not configured on either Meta or Twilio.");
        }
      } else if (channel === "sms") {
        // Twilio SMS
        if (!twilioService.isSmsConfigured()) {
          throw new Error("Twilio SMS is not configured.");
        }
        const result = await twilioService.sendTwilioMessage({
          to: normalizedPhone,
          body: messageBody,
          channel: "sms",
          statusCallbackUrl,
        });
        await logNotificationAttempt({
          restaurantId,
          orderId,
          phone: normalizedPhone,
          channel: "sms",
          purpose,
          status: result.status || "queued",
          provider: "twilio",
          providerRef: result.providerRef,
          idempotencyKey: effectiveIdempotencyKey,
        });
        return { success: true, channel: "sms", providerRef: result.providerRef, provider: "twilio" };
      }
    } catch (err) {
      lastError = err;
      await logNotificationAttempt({
        restaurantId,
        orderId,
        phone: normalizedPhone,
        channel,
        purpose,
        status: "failed",
        provider: "twilio",
        errorCode: err.details?.code ? String(err.details.code) : null,
        errorMessage: err.message,
        idempotencyKey: effectiveIdempotencyKey,
      });
      // Fall through to next channel if allowed
    }
  }

  console.error("Communication dispatch failed across all channels:", lastError?.message);
  return { success: false, error: lastError?.message || "Delivery failed" };
}

/**
 * Webhook handler for Twilio delivery status callbacks.
 * Statuses: queued, sent, delivered, undelivered, failed
 */
async function processTwilioStatusCallback(payload) {
  const messageSid = payload.MessageSid || payload.SmsSid;
  const messageStatus = payload.MessageStatus || payload.SmsStatus;
  const errorCode = payload.ErrorCode || null;
  const errorMessage = payload.ErrorMessage || null;

  if (!messageSid || !messageStatus) {
    return { ignored: true, reason: "Missing MessageSid or MessageStatus" };
  }

  const logEntry = await prisma.notificationLog.findFirst({
    where: { providerRef: messageSid },
  });

  if (!logEntry) {
    return { ignored: true, reason: "No matching NotificationLog for SID" };
  }

  const isDelivered = messageStatus.toLowerCase() === "delivered";
  const isFailed = ["failed", "undelivered"].includes(messageStatus.toLowerCase());

  await prisma.notificationLog.update({
    where: { id: logEntry.id },
    data: {
      status: messageStatus.toLowerCase(),
      errorCode: errorCode ? String(errorCode) : logEntry.errorCode,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : logEntry.errorMessage,
      deliveredAt: isDelivered ? new Date() : logEntry.deliveredAt,
    },
  });

  return { processed: true, id: logEntry.id, status: messageStatus.toLowerCase() };
}

/**
 * Aggregates delivery metrics for platform dashboard.
 */
async function getCommunicationStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalCount, deliveredCount, failedCount, queuedCount, logs] = await Promise.all([
    prisma.notificationLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notificationLog.count({ where: { status: "delivered", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notificationLog.count({ where: { status: { in: ["failed", "undelivered"] }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notificationLog.count({ where: { status: { in: ["queued", "sent"] }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notificationLog.groupBy({
      by: ["channel", "purpose"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const deliveryRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 1000) / 10 : 100;

  return {
    totalMessages: totalCount,
    delivered: deliveredCount,
    failed: failedCount,
    queued: queuedCount,
    deliveryRate,
    breakdown: logs.map((item) => ({
      channel: item.channel,
      purpose: item.purpose,
      count: item._count.id,
    })),
  };
}

module.exports = {
  DEFAULT_TEMPLATES,
  renderTemplate,
  getTemplate,
  normalizePhoneNumber,
  dispatchMessage,
  processTwilioStatusCallback,
  getCommunicationStats,
};
