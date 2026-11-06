const MENU_LANGUAGES = ["en", "hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "ar"];

function localizeMenu(record, language) {
  const translation = language === "en" ? null : record.translations?.[language];
  const localized = { ...record, originalName: record.name };
  delete localized.translations;
  if (translation?.name?.trim()) localized.name = translation.name;
  if (translation?.description?.trim()) localized.description = translation.description;
  for (const key of ["variants", "addons"]) {
    if (!Array.isArray(record[key])) continue;
    localized[key] = record[key].map((option, index) => {
      const translatedName = translation?.[key]?.[index];
      return translatedName?.trim() ? { ...option, originalName: option.name, name: translatedName } : option;
    });
  }
  return localized;
}

function withMissingTranslations(record, fields = ["name"]) {
  return {
    ...record,
    missingTranslationLanguages: MENU_LANGUAGES.filter((language) => (
      language !== "en" && fields.some((field) => !record.translations?.[language]?.[field]?.trim())
    )),
  };
}

module.exports = { localizeMenu, withMissingTranslations };
