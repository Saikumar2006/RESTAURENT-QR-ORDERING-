import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './store/AuthContext.jsx';
import { detectLanguage, getDirection, getTranslation, LANGUAGES } from './i18n/resources.js';

const LANGUAGE_STORAGE_KEY = "svaadya_language";
const LanguageContext = createContext({ language: "en", direction: "ltr", setLanguage: async () => {}, t: (key) => key });

function getInitialLanguage() {
  try {
    return detectLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY), navigator.languages || [navigator.language]);
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }) {
  const { user, setPreferredLanguage } = useAuth();
  const [guestLanguage, setGuestLanguage] = useState(getInitialLanguage);
  const [languageOverride, setLanguageOverride] = useState(null);
  const language = languageOverride || user?.preferredLanguage || guestLanguage;
  const direction = getDirection(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.documentElement.dataset.language = language;
  }, [language, direction]);

  const setLanguage = useCallback(async (next) => {
    if (!LANGUAGES.some(([code]) => code === next)) throw new Error("Choose a supported language.");
    setLanguageOverride(next);
    setGuestLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch (error) {
      console.error("Could not save the language preference in this browser.", error);
    }
    if (user) await setPreferredLanguage(next);
  }, [setPreferredLanguage, user]);

  const value = useMemo(() => ({
    language,
    direction,
    setLanguage,
    t: (key, values) => getTranslation(language, key, values),
  }), [language, direction, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() { return useContext(LanguageContext); }

export function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, t } = useTranslation();
  const [saveError, setSaveError] = useState("");

  async function handleChange(event) {
    setSaveError("");
    try {
      await setLanguage(event.target.value);
    } catch {
      setSaveError("Language changed for this session, but your account preference could not be saved.");
    }
  }

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <label className="inline-flex items-center gap-2 text-xs text-charcoal/65">
        <span>{t("language")}</span>
        <select
          aria-label={t("language")}
          className="rounded-md border border-charcoal/15 bg-white px-2 py-1.5 text-xs text-charcoal"
          value={language}
          onChange={handleChange}
        >
          {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      {saveError && <span className="max-w-56 text-[10px] text-rose-700" role="status">{saveError}</span>}
    </span>
  );
}
