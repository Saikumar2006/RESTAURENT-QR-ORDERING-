const { ApiError } = require("../utils/http");
const env = require("../config/env");

const REQUIRED_CONFIG = [
  ["WHATSAPP_PHONE_NUMBER_ID", "whatsappPhoneNumberId"],
  ["WHATSAPP_BUSINESS_ACCOUNT_ID", "whatsappBusinessAccountId"],
  ["WHATSAPP_ACCESS_TOKEN", "whatsappAccessToken"],
  ["WHATSAPP_OTP_TEMPLATE_NAME", "whatsappOtpTemplateName"],
  ["WHATSAPP_API_VERSION", "whatsappApiVersion"],
];

function assertConfigured() {
  const missing = REQUIRED_CONFIG
    .filter(([, key]) => !env[key])
    .map(([name]) => name);

  if (missing.length) {
    throw new ApiError(503, "Platform WhatsApp OTP is not configured.", { missing });
  }
  if (!/^v\d+\.\d+$/.test(env.whatsappApiVersion)) {
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

module.exports = { assertConfigured, sendWhatsAppOtp };
