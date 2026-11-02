const assert = require("node:assert/strict");
const { test } = require("node:test");
const crypto = require("node:crypto");
const twilioService = require("../src/services/twilioService");
const communicationsService = require("../src/services/communicationsService");

test("Twilio service detects configuration and masks secrets safely", () => {
  const dummyConfig = {
    twilioAccountSid: "MOCK_TWILIO_ACCOUNT_SID_EXAMPLE",
    twilioAuthToken: "mock_auth_token_for_tests",
    twilioPhoneNumber: "+14155550123",
    twilioWhatsappFrom: "whatsapp:+14155238886",
    twilioEnabled: true,
  };

  const status = twilioService.getConnectionStatus(dummyConfig);
  assert.equal(status.enabled, true);
  assert.equal(status.accountSidConfigured, true);
  assert.equal(status.accountSidMasked, "MOCK••••••••MPLE");
  assert.equal(status.smsConfigured, true);
  assert.equal(status.whatsappConfigured, true);
  assert.match(status.smsSender, /^\+14••••••0123$/);
  assert.match(status.whatsappSender, /^whatsapp:\+14••••••8886$/);
});

test("Twilio webhook signature validator rejects forged signatures and accepts valid ones", () => {
  const authToken = "12345authSecretToken";
  const url = "https://restaurent-qr-ordering.onrender.com/api/communications/twilio/webhook/status";
  const params = {
    MessageSid: "SM12345",
    MessageStatus: "delivered",
    To: "+919876543210",
  };

  // Compute expected signature
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += `${key}${params[key]}`;
  }
  const validSignature = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");

  assert.equal(twilioService.validateTwilioSignature(validSignature, url, params, authToken), true);
  assert.equal(twilioService.validateTwilioSignature("tampered_sig", url, params, authToken), false);
  assert.equal(twilioService.validateTwilioSignature(validSignature, url, { ...params, MessageStatus: "failed" }, authToken), false);
});

test("Communications template engine hydrates variables correctly", () => {
  const tpl = "Hello {{name}}, your order #{{orderNumber}} at {{restaurantName}} is {{status}}!";
  const hydrated = communicationsService.renderTemplate(tpl, {
    name: "John",
    orderNumber: 42,
    restaurantName: "Spice Garden",
    status: "READY",
  });

  assert.equal(hydrated, "Hello John, your order #42 at Spice Garden is READY!");
});

test("Communications normalization accepts E.164 and normalizes international numbers", () => {
  assert.equal(communicationsService.normalizePhoneNumber("+919876543210"), "+919876543210");
  assert.equal(communicationsService.normalizePhoneNumber("919876543210"), "+919876543210");
  assert.equal(communicationsService.normalizePhoneNumber("invalid"), null);
});

test("Communications dispatch in mock development records to NotificationLog without throwing", async () => {
  const result = await communicationsService.dispatchMessage({
    phone: "+919876543210",
    purpose: "otp",
    templateKey: "OTP_VERIFICATION",
    templateData: { code: "654321" },
    preferredChannel: "sms",
  });

  assert.equal(result.success, true);
  assert.match(result.providerRef, /^mock_/);
});

test("Communications dispatch with duplicate idempotencyKey returns existing record without re-sending", async () => {
  const key = `test_idem_${Date.now()}`;
  const first = await communicationsService.dispatchMessage({
    phone: "+919876543210",
    purpose: "order_confirmation",
    customBody: "Order 101 confirmed",
    idempotencyKey: key,
  });
  assert.equal(first.success, true);

  const second = await communicationsService.dispatchMessage({
    phone: "+919876543210",
    purpose: "order_confirmation",
    customBody: "Order 101 confirmed",
    idempotencyKey: key,
  });

  assert.equal(second.success, true);
  assert.equal(second.deduplicated, true);
});
