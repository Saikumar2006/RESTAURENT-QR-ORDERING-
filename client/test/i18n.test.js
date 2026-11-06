import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLanguage,
  formatCurrency,
  formatDateTime,
  formatNumber,
  getDirection,
  getLocale,
  getTranslation,
  LANGUAGES,
  STRINGS,
} from "../src/i18n/resources.js";

test("the supported language catalog is the exact requested set with complete translations", () => {
  const keys = Object.keys(STRINGS.en).sort();
  const expectedLanguages = ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "ar"];
  assert.equal(LANGUAGES.length, 11);
  assert.deepEqual(LANGUAGES.map(([code]) => code), expectedLanguages);
  assert.deepEqual(Object.keys(STRINGS).sort(), LANGUAGES.map(([code]) => code).sort());
  for (const [language] of LANGUAGES) {
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), keys, `${language} catalog keys`);
    for (const [key, value] of Object.entries(STRINGS[language])) {
      assert.equal(typeof value, "string", `${language}.${key} must be a string`);
      assert.ok(value.trim(), `${language}.${key} must not be empty`);
      assert.doesNotMatch(value, /(?:à¤|à°|à®|à²|à´|à¦|àª|à¨|à¬)/, `${language}.${key} must not contain mojibake`);
    }
  }
  assert.equal(getLocale("ar"), "ar-SA-u-nu-latn");
  assert.equal(getDirection("ar"), "rtl");
  assert.equal(getDirection("hi"), "ltr");
});

test("saved language wins over browser languages and unsupported browser languages fall back to English", () => {
  assert.equal(detectLanguage("ta", ["hi-IN"]), "ta");
  assert.equal(detectLanguage(null, ["fr-FR", "ar-EG", "hi-IN"]), "ar");
  assert.equal(detectLanguage(null, ["fr-FR"]), "en");
});

test("unknown language codes safely fall back to English translations and locale", () => {
  assert.equal(getLocale("xx"), "en-IN");
  assert.equal(getTranslation("xx", "orders"), STRINGS.en.orders);
  assert.equal(getTranslation("en", "unknown.key"), "unknown.key");
  assert.equal(getTranslation("en", "itemCount", { count: 3 }), "3 items");
});

test("locale-aware formatters accept the restaurant currency and timezone", () => {
  assert.equal(formatNumber(12345.6, "en"), "12,345.6");
  assert.match(formatCurrency(1234, "INR", "ar"), /١|1/);
  assert.ok(formatDateTime("2026-01-02T03:04:00Z", "ar", "Asia/Kolkata"));
});
