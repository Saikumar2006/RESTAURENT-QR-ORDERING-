const { ApiError } = require("../utils/http");
const env = require("../config/env");

const REQUIRED_CONFIG = [
  ["WHATSAPP_PHONE_NUMBER_ID", "whatsappPhoneNumberId"],
  ["WHATSAPP_BUSINESS_ACCOUNT_ID", "whatsappBusinessAccountId"],
  ["WHATSAPP_ACCESS_TOKEN", "whatsappAccessToken"],
  ["WHATSAPP_OTP_TEMPLATE_NAME", "whatsappOtpTemplateName"],
  ["WHATSAPP_API_VERSION", "whatsappApiVersion"],
];

function assertConfigured(config = env) {
  const missing = REQUIRED_CONFIG
    .filter(([, key]) => !config[key])
    .map(([name]) => name);

  if (missing.length) {
    throw new ApiError(503, "Platform WhatsApp OTP is not configured.", { missing });
  }
  if (!/^v\d+\.\d+$/.test(config.whatsappApiVersion)) {
    throw new ApiError(503, "Platform WhatsApp OTP has an invalid API version.", {
      invalid: "WHATSAPP_API_VERSION",
    });
  }
}

function providerErrorDetails(status, body) {
  const metaError = body?.error || {};
  const details = { provider: "meta", status };
  if (Number.isInteger(metaError.code)) details.code = metaError.code;
  if (Number.isInteger(metaError.error_subcode)) details.subcode = metaError.error_subcode;
  if (typeof metaError.fbtrace_id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(metaError.fbtrace_id)) {
    details.traceId = metaError.fbtrace_id;
  }
  return details;
}

function getConnectionStatus(config = env) {
  const missing = REQUIRED_CONFIG.filter(([, key]) => !config[key]).map(([name]) => name);
  const invalid = config.whatsappApiVersion && !/^v\d+\.\d+$/.test(config.whatsappApiVersion)
    ? ["WHATSAPP_API_VERSION"]
    : [];
  return {
    provider: "Meta WhatsApp Cloud API",
    configured: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    senderConfigured: Boolean(config.whatsappPhoneNumberId),
    businessAccountConfigured: Boolean(config.whatsappBusinessAccountId),
    credentialConfigured: Boolean(config.whatsappAccessToken),
    templateName: config.whatsappOtpTemplateName || null,
    templateStatus: "NOT_CHECKED",
    connectionStatus: "NOT_TESTED",
  };
}

function maskPhoneNumber(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return `${value.trim().startsWith("+") ? "+" : ""}${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function readMetaJson(url, fetchImpl, accessToken) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(502, "WhatsApp connection check timed out or could not reach Meta.", { provider: "meta", reason: "network_or_timeout" });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details = providerErrorDetails(response.status, body);
    throw new ApiError(502, "WhatsApp connection check failed. Review the server-side Meta configuration and permissions.", details);
  }
  return body || {};
}

async function testConnection(fetchImpl = globalThis.fetch, config = env) {
  assertConfigured(config);
  const apiRoot = `https://graph.facebook.com/${config.whatsappApiVersion}`;
  const phoneUrl = new URL(`${apiRoot}/${encodeURIComponent(config.whatsappPhoneNumberId)}`);
  phoneUrl.searchParams.set("fields", "display_phone_number,verified_name,quality_rating");
  const phone = await readMetaJson(phoneUrl.toString(), fetchImpl, config.whatsappAccessToken);

  const templatesUrl = new URL(`${apiRoot}/${encodeURIComponent(config.whatsappBusinessAccountId)}/message_templates`);
  templatesUrl.searchParams.set("name", config.whatsappOtpTemplateName);
  templatesUrl.searchParams.set("fields", "name,status,language");
  const templates = await readMetaJson(templatesUrl.toString(), fetchImpl, config.whatsappAccessToken);
  const matched = Array.isArray(templates.data)
    ? templates.data.find((template) => template?.name === config.whatsappOtpTemplateName)
    : null;
  const status = typeof matched?.status === "string" ? matched.status : "NOT_FOUND";
  return {
    provider: "Meta WhatsApp Cloud API",
    connectionStatus: "CONNECTED",
    templateName: config.whatsappOtpTemplateName,
    templateStatus: status,
    senderPhoneMasked: maskPhoneNumber(phone.display_phone_number),
    verifiedName: typeof phone.verified_name === "string" ? phone.verified_name.slice(0, 120) : null,
    qualityRating: typeof phone.quality_rating === "string" ? phone.quality_rating : null,
    checkedAt: new Date().toISOString(),
  };
}

async function sendWhatsAppOtp(phoneNumber, otp) {
  assertConfigured();
  if (typeof phoneNumber !== "string" || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new ApiError(400, "A valid international phone number is required.");
  }
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    throw new ApiError(400, "A valid six-digit verification code is required.");
  }

  const endpoint =
    `https://graph.facebook.com/${env.whatsappApiVersion}/` +
    `${encodeURIComponent(env.whatsappPhoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber.slice(1),
    type: "template",
    template: {
      name: env.whatsappOtpTemplateName,
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    const details = { provider: "meta", reason: "network_or_timeout" };
    console.error("Meta WhatsApp OTP request failed", details);
    throw new ApiError(502, "WhatsApp delivery failed. Check platform WhatsApp connectivity and try again.", details);
  }

  if (!response.ok) {
    const providerBody = await response.json().catch(() => null);
    const details = providerErrorDetails(response.status, providerBody);
    console.error("Meta WhatsApp OTP request failed", details);
    throw new ApiError(
      502,
      "WhatsApp delivery failed. Check the platform phone number, template approval, and Meta error details.",
      details
    );
  }

  return { success: true };
}

module.exports = { assertConfigured, getConnectionStatus, testConnection, maskPhoneNumber, sendWhatsAppOtp };
