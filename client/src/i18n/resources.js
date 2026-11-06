import en from "./locales/en.js";
import hi from "./locales/hi.js";
import te from "./locales/te.js";
import ta from "./locales/ta.js";
import kn from "./locales/kn.js";
import ml from "./locales/ml.js";
import mr from "./locales/mr.js";
import bn from "./locales/bn.js";
import gu from "./locales/gu.js";
import pa from "./locales/pa.js";
import ar from "./locales/ar.js";

export const LANGUAGES = [
  ["en", "English"], ["hi", "हिन्दी"], ["te", "తెలుగు"], ["ta", "தமிழ்"], ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"], ["mr", "मराठी"], ["bn", "বাংলা"], ["gu", "ગુજરાતી"], ["pa", "ਪੰਜਾਬੀ"], ["ar", "العربية"],
];

export const STRINGS = { en, hi, te, ta, kn, ml, mr, bn, gu, pa, ar };

const LOCALES = {
  en: "en-IN", hi: "hi-IN", te: "te-IN", ta: "ta-IN", kn: "kn-IN",
  ml: "ml-IN", mr: "mr-IN", bn: "bn-IN", gu: "gu-IN", pa: "pa-IN",
  ar: "ar-SA-u-nu-latn",
};

const SUPPORTED_LANGUAGES = new Set(LANGUAGES.map(([code]) => code));

export function getLocale(language) {
  return LOCALES[language] || LOCALES.en;
}

export function getDirection(language) {
  return language === "ar" ? "rtl" : "ltr";
}

export function detectLanguage(savedLanguage, browserLanguages = []) {
  if (SUPPORTED_LANGUAGES.has(savedLanguage)) return savedLanguage;
  for (const candidate of browserLanguages) {
    const language = String(candidate).toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED_LANGUAGES.has(language)) return language;
  }
  return "en";
}

export function getTranslation(language, key, values = {}) {
  const template = STRINGS[language]?.[key] || STRINGS.en[key] || key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => (
    Object.hasOwn(values, name) ? String(values[name]) : match
  ));
}

export function formatNumber(value, language = "en") {
  return new Intl.NumberFormat(getLocale(language)).format(value);
}

export function formatCurrency(value, currency = "INR", language = "en") {
  return new Intl.NumberFormat(getLocale(language), {
    style: "currency",
    currency,
    numberingSystem: "latn",
  }).format(value);
}

export function formatDateTime(value, language = "en", timeZone) {
  return new Intl.DateTimeFormat(getLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(value instanceof Date ? value : new Date(value));
}
