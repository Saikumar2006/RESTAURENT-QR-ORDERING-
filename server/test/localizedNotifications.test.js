const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocalizedNotificationTemplate, LOCALIZED_NOTIFICATION_TEMPLATES } = require("../src/services/localizedNotificationTemplates");
const communicationsService = require("../src/services/communicationsService");

test("localized notification templates contain all 11 supported languages and required keys", () => {
  const expectedLanguages = ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "ar"];
  const expectedKeys = [
    "OTP_VERIFICATION",
    "ORDER_CONFIRMATION",
    "ORDER_STATUS_UPDATE",
    "OWNER_NEW_ORDER",
    "STAFF_INVITATION",
    "STAFF_PASSWORD_RESET",
    "SUBSCRIPTION_SUCCESS",
    "SUBSCRIPTION_FAILED",
  ];

  assert.equal(Object.keys(LOCALIZED_NOTIFICATION_TEMPLATES).length, 11);
  for (const lang of expectedLanguages) {
    const catalog = LOCALIZED_NOTIFICATION_TEMPLATES[lang];
    assert.ok(catalog, `catalog for ${lang} must exist`);
    for (const key of expectedKeys) {
      assert.ok(catalog[key], `${lang}.${key} must exist`);
      assert.equal(typeof catalog[key], "string");
      assert.ok(catalog[key].length > 0);
    }
  }
});

test("getLocalizedNotificationTemplate returns localized text and falls back to English for unknown language", () => {
  const hiOtp = getLocalizedNotificationTemplate("OTP_VERIFICATION", "hi");
  assert.match(hiOtp, /सत्यापन कोड/);

  const arOtp = getLocalizedNotificationTemplate("OTP_VERIFICATION", "ar");
  assert.match(arOtp, /رمز التحقق/);

  const fallback = getLocalizedNotificationTemplate("OTP_VERIFICATION", "xx");
  assert.match(fallback, /verification code/);
});

test("communications dispatchMessage hydrates localized templates", async () => {
  const res = await communicationsService.dispatchMessage({
    phone: "+919876543210",
    purpose: "order_confirmation",
    templateKey: "ORDER_CONFIRMATION",
    templateData: {
      restaurantName: "Royal Spice",
      orderNumber: "501",
      totalAmount: "450",
      itemsSummary: "Paneer Butter Masala (1)",
      trackingUrl: "https://svaadya.com/r/royal/orders/501",
    },
    language: "hi",
    preferredChannel: "sms",
    allowFallback: false,
    idempotencyKey: `test_localized_order_${Date.now()}`,
  });

  assert.equal(res.success, true);
});
