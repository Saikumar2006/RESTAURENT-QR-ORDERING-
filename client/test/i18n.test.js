import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, STRINGS, getLocale } from "../src/i18n/resources.js";

test("all eleven supported languages have a complete, readable navigation catalog", () => {
  const keys = Object.keys(STRINGS.en).sort();
  assert.equal(LANGUAGES.length, 11);
  assert.deepEqual(Object.keys(STRINGS).sort(), LANGUAGES.map(([code]) => code).sort());
  for (const [language] of LANGUAGES) {
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), keys, `${language} catalog keys`);
    for (const [key, value] of Object.entries(STRINGS[language])) {
      assert.equal(typeof value, "string", `${language}.${key} must be a string`);
      assert.ok(value.trim(), `${language}.${key} must not be empty`);
      assert.doesNotMatch(value, /(?:à¤|à°|à®|à²|à´|à¦|àª|à¨|à¬)/, `${language}.${key} must not contain mojibake`);
    }
    assert.match(getLocale(language), /-IN$/);
  }
});

test("unknown language codes safely fall back to Indian English formatting", () => {
  assert.equal(getLocale("xx"), "en-IN");
});
