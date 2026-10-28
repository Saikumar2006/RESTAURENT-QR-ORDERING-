const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "987654321";
process.env.WHATSAPP_ACCESS_TOKEN = "test-secret-token";
process.env.WHATSAPP_OTP_TEMPLATE_NAME = "authentication_code";
process.env.WHATSAPP_API_VERSION = "v22.0";

const originalFetch = global.fetch;
const originalConsoleError = console.error;
const env = require("../src/config/env");
const whatsappService = require("../src/services/whatsappService");

afterEach(() => {
  global.fetch = originalFetch;
  console.error = originalConsoleError;
});

const config = {
  whatsappPhoneNumberId: "phone-id-safe",
  whatsappBusinessAccountId: "business-id-safe",
  whatsappAccessToken: "secret-token-must-not-return",
  whatsappOtpTemplateName: "svaadya_otp",
  whatsappApiVersion: "v22.0",
};

test("WhatsApp status exposes only readiness and never credential values", () => {
  const status = whatsappService.getConnectionStatus(config);
  assert.equal(status.configured, true);
  assert.equal(status.senderConfigured, true);
  assert.equal(status.businessAccountConfigured, true);
  assert.equal(status.credentialConfigured, true);
  assert.equal(status.templateName, "svaadya_otp");
  assert.equal(status.connectionStatus, "NOT_TESTED");
  assert.equal(JSON.stringify(status).includes(config.whatsappAccessToken), false);
  const missing = whatsappService.getConnectionStatus({ ...config, whatsappAccessToken: "" });
  assert.equal(missing.configured, false);
  assert.ok(missing.missing.includes("WHATSAPP_ACCESS_TOKEN"));
});

test("connection test checks sender and named template with read-only Meta requests", async () => {
  const requests = [];
  const responses = [
    { display_phone_number: "+919876543210", verified_name: "Svaadya", quality_rating: "GREEN" },
    { data: [{ name: "svaadya_otp", status: "APPROVED", language: "en_US" }] },
  ];
  const result = await whatsappService.testConnection(async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, async json() { return responses.shift(); } };
  }, config);

  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.method === "GET"));
  assert.ok(requests.every(({ options }) => options.headers.Authorization === `Bearer ${config.whatsappAccessToken}`));
  assert.equal(requests[0].url.pathname, "/v22.0/phone-id-safe");
  assert.equal(requests[1].url.pathname, "/v22.0/business-id-safe/message_templates");
  assert.equal(requests[1].url.searchParams.get("name"), config.whatsappOtpTemplateName);
  assert.equal(result.connectionStatus, "CONNECTED");
  assert.equal(result.templateStatus, "APPROVED");
  assert.equal(result.senderPhoneMasked, "+••••••••3210");
  assert.equal(JSON.stringify(result).includes(config.whatsappAccessToken), false);
});

test("provider errors return sanitized status metadata without Meta text or secrets", async () => {
  await assert.rejects(whatsappService.testConnection(async () => ({
    ok: false,
    status: 403,
    async json() { return { error: { message: `bad ${config.whatsappAccessToken}`, code: 10, fbtrace_id: "trace-safe" } }; },
  }), config), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.details.status, 403);
    assert.equal(error.details.code, 10);
    assert.equal(error.details.traceId, "trace-safe");
    assert.equal(JSON.stringify(error.details).includes(config.whatsappAccessToken), false);
    assert.equal(error.message.includes(config.whatsappAccessToken), false);
    return true;
  });
});

test("unconfigured WhatsApp cannot trigger an external connection request", async () => {
  let called = false;
  await assert.rejects(whatsappService.testConnection(async () => { called = true; }, { ...config, whatsappAccessToken: "" }), { status: 503 });
  assert.equal(called, false);
});

test("sends an approved authentication template with Meta's body and copy-code button parameters", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };

  assert.deepEqual(await whatsappService.sendWhatsAppOtp("+919876543210", "123456"), { success: true });
  assert.equal(request.url, "https://graph.facebook.com/v22.0/123456789/messages");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-secret-token");
  const body = JSON.parse(request.options.body);
  assert.equal(body.to, "919876543210");
  assert.equal(body.messaging_product, "whatsapp");
  assert.equal(body.template.name, "authentication_code");
  assert.deepEqual(body.template.language, { code: "en_US" });
  assert.deepEqual(body.template.components, [
    { type: "body", parameters: [{ type: "text", text: "123456" }] },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "123456" }],
    },
  ]);
});

test("rejects malformed input before making a provider request", async () => {
  let called = false;
  global.fetch = async () => {
    called = true;
    return { ok: true, status: 200 };
  };
  await assert.rejects(whatsappService.sendWhatsAppOtp("919876543210", "123456"), { status: 400 });
  await assert.rejects(whatsappService.sendWhatsAppOtp("+919876543210", "12"), { status: 400 });
  assert.equal(called, false);
});

test("returns sanitized Meta diagnostics without exposing provider text or credentials", async () => {
  const originalToken = env.whatsappAccessToken;
  env.whatsappAccessToken = "secret-must-not-leak";
  global.fetch = async () => ({
    ok: false,
    status: 400,
    async json() {
      return {
        error: {
          message: "Rejected token secret-must-not-leak and OTP 123456",
          code: 132001,
          error_subcode: 2388001,
          fbtrace_id: "trace_123",
        },
      };
    },
  });
  console.error = () => {};
  try {
    await assert.rejects(whatsappService.sendWhatsAppOtp("+919876543210", "123456"), (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.details.provider, "meta");
      assert.equal(error.details.code, 132001);
      assert.equal(error.details.subcode, 2388001);
      assert.equal(error.details.traceId, "trace_123");
      assert.doesNotMatch(JSON.stringify(error), /secret-must-not-leak|123456|Rejected token/);
      return true;
    });
  } finally {
    env.whatsappAccessToken = originalToken;
  }
});

test("Render manifest declares the complete platform-owned WhatsApp configuration", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const renderManifest = fs.readFileSync(path.join(__dirname, "..", "..", "render.yaml"), "utf8");
  for (const key of [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_OTP_TEMPLATE_NAME",
    "WHATSAPP_API_VERSION",
  ]) {
    assert.match(renderManifest, new RegExp(`- key: ${key}\\s+sync: false`));
  }
  assert.match(renderManifest, /- key: PAYMENT_PROVIDER\s+sync: false/);
  assert.match(renderManifest, /- key: MESSAGING_PROVIDER\s+sync: false/);
});
