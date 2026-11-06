const test = require("node:test");
const assert = require("node:assert/strict");
const { localizeMenu, withMissingTranslations } = require("../src/utils/menuLocalization");

test("localized menu content uses translations without changing the source record", () => {
  const source = {
    name: "Paneer curry",
    description: "Creamy curry",
    variants: [{ name: "Regular" }],
    addons: [{ name: "Extra cheese" }],
    translations: {
      hi: {
        name: "पनीर करी",
        description: "मलाईदार करी",
        variants: ["नियमित"],
        addons: ["अतिरिक्त चीज़"],
      },
    },
  };
  const localized = localizeMenu(source, "hi");
  assert.equal(localized.name, "पनीर करी");
  assert.equal(localized.description, "मलाईदार करी");
  assert.equal(localized.variants[0].name, "नियमित");
  assert.equal(localized.addons[0].name, "अतिरिक्त चीज़");
  assert.equal(localized.originalName, "Paneer curry");
  assert.equal(source.name, "Paneer curry");
});

test("missing menu translations fall back to source content", () => {
  const source = { name: "Idli", description: null, translations: { hi: { name: "" } } };
  const localized = localizeMenu(source, "hi");
  assert.equal(localized.name, "Idli");
  assert.equal(withMissingTranslations(source).missingTranslationLanguages.length, 10);
  assert.equal(withMissingTranslations(source, ["name"]).missingTranslationLanguages.includes("hi"), true);
});
