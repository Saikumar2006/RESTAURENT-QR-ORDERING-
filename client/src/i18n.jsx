import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './store/AuthContext.jsx';
import { LANGUAGES, STRINGS } from './i18n/resources.js';

const LanguageContext = createContext({ language: "en", setLanguage: async () => {}, t: (key) => key });
export function LanguageProvider({ children }) {
  const { user, setPreferredLanguage } = useAuth();
  const [guestLanguage, setGuestLanguage] = useState(() => localStorage.getItem("svaadya_language") || "en");
  const language = user?.preferredLanguage || guestLanguage;
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  }, [language]);
  const setLanguage = useCallback(async (next) => {
    if (!LANGUAGES.some(([code]) => code === next)) return;
    localStorage.setItem("svaadya_language", next);
    setGuestLanguage(next);
    if (user) await setPreferredLanguage(next);
  }, [setPreferredLanguage, user]);
  const value = useMemo(() => ({ language, setLanguage, t: (key) => STRINGS[language]?.[key] || STRINGS.en[key] || key }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() { return useContext(LanguageContext); }

export function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, t } = useTranslation();
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-charcoal/65 ${className}`}>
      <span>{t("language")}</span>
      <select aria-label={t("language")} className="rounded-md border border-charcoal/15 bg-white px-2 py-1.5 text-xs text-charcoal" value={language} onChange={(event) => setLanguage(event.target.value)}>
        {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
    </label>
  );
}
