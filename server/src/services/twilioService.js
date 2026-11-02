const crypto = require("crypto");
const env = require("../config/env");
const { ApiError } = require("../utils/http");

function maskSecret(val, visibleDigits = 4) {
  if (!val || typeof val !== "string") return null;
  const str = val.trim();
  if (str.length <= visibleDigits * 2) return "••••••••";
  return `${str.slice(0, visibleDigits)}••••••••${str.slice(-visibleDigits)}`;
}

function maskPhone(val) {
  if (!val || typeof val !== "string") return null;
  const isWhatsapp = val.startsWith("whatsapp:");
  const clean = val.replace(/^whatsapp:/, "").trim();
  if (clean.length < 5) return val;
  const masked = `${clean.slice(0, 3)}••••••${clean.slice(-4)}`;
  return isWhatsapp ? `whatsapp:${masked}` : masked;
}

function isSmsConfigured(config = env) {
  return Boolean(
    config.twilioAccountSid &&
    config.twilioAuthToken &&
    (config.twilioPhoneNumber || config.twilioSmsFrom)
  );
}

function isWhatsappConfigured(config = env) {
  return Boolean(
    config.twilioAccountSid &&
    config.twilioAuthToken &&
    config.twilioWhatsappFrom
  );
}

function getConnectionStatus(config = env) {
  const smsReady = isSmsConfigured(config);
  const whatsappReady = isWhatsappConfigured(config);

  return {
    provider: "Twilio",
    enabled: Boolean(config.twilioEnabled),
    accountSidConfigured: Boolean(config.twilioAccountSid),
    accountSidMasked: maskSecret(config.twilioAccountSid, 4),
    smsConfigured: smsReady,
    smsSender: maskPhone(config.twilioPhoneNumber || config.twilioSmsFrom),
    whatsappConfigured: whatsappReady,
    whatsappSender: maskPhone(config.twilioWhatsappFrom),
    overallReady: smsReady || whatsappReady,
  };
}

async function testConnection(fetchImpl = globalThis.fetch, config = env) {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    throw new ApiError(503, "Twilio account SID or Auth Token is not configured.");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}.json`;
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");

  let res;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(502, "Twilio connection check timed out or network error.");
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.message || `Twilio returned status ${res.status}`;
    const code = body.code || res.status;
    throw new ApiError(502, `Twilio validation failed: ${message}`, { code });
  }

  return {
    provider: "Twilio",
    connectionStatus: "CONNECTED",
    accountStatus: body.status || "active",
    friendlyName: body.friendly_name || "Twilio Account",
    type: body.type || "Full",
    smsSender: maskPhone(config.twilioPhoneNumber || config.twilioSmsFrom),
    smsReady: isSmsConfigured(config),
    whatsappSender: maskPhone(config.twilioWhatsappFrom),
    whatsappReady: isWhatsappConfigured(config),
    checkedAt: new Date().toISOString(),
  };
}

async function sendTwilioMessage({ to, body, channel = "sms", statusCallbackUrl = null }, fetchImpl = globalThis.fetch, config = env) {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    throw new ApiError(503, "Twilio credentials are not configured on the server.");
  }

  const isWhatsapp = channel === "whatsapp";
  const from = isWhatsapp ? config.twilioWhatsappFrom : (config.twilioPhoneNumber || config.twilioSmsFrom);

  if (!from) {
    throw new ApiError(503, `Twilio ${channel.toUpperCase()} sender address is not configured.`);
  }

  const toAddress = isWhatsapp
    ? (to.startsWith("whatsapp:") ? to : `whatsapp:${to}`)
    : to.replace(/^whatsapp:/, "");

  const fromAddress = isWhatsapp
    ? (from.startsWith("whatsapp:") ? from : `whatsapp:${from}`)
    : from.replace(/^whatsapp:/, "");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Messages.json`;
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");

  const params = new URLSearchParams({
    To: toAddress,
    From: fromAddress,
    Body: body,
  });

  if (statusCallbackUrl) {
    params.set("StatusCallback", statusCallbackUrl);
  }

  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new ApiError(502, "Twilio message dispatch timed out or network error.", { reason: err.message });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorDetails = {
      provider: "twilio",
      status: res.status,
      code: data.code || null,
      message: data.message || "Failed to dispatch message via Twilio",
    };
    throw new ApiError(502, errorDetails.message, errorDetails);
  }

  return {
    success: true,
    provider: "twilio",
    providerRef: data.sid,
    status: data.status || "queued",
    channel,
  };
}

/**
 * Validates Twilio's X-Twilio-Signature header using HMAC-SHA1.
 * Matches official Twilio specification:
 * Take full URL, sort POST parameters alphabetically, concatenate key+value, HMAC-SHA1 with Auth Token.
 */
function validateTwilioSignature(signature, fullUrl, postParams = {}, authToken = env.twilioAuthToken) {
  if (!signature || typeof signature !== "string" || !authToken) return false;

  const sortedKeys = Object.keys(postParams || {}).sort();
  let data = fullUrl;
  for (const key of sortedKeys) {
    data += `${key}${postParams[key] ?? ""}`;
  }

  const expectedSignature = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");

  try {
    const sigBuffer = Buffer.from(signature, "base64");
    const expectedBuffer = Buffer.from(expectedSignature, "base64");
    return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

module.exports = {
  isSmsConfigured,
  isWhatsappConfigured,
  getConnectionStatus,
  testConnection,
  sendTwilioMessage,
  validateTwilioSignature,
  maskPhone,
  maskSecret,
};
