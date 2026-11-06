import React, { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "../i18n/resources.js";
import { useTranslation } from "../i18n.jsx";

const LANGUAGE_DETAILS = {
  en: { native: "English", english: "English", script: "Latin" },
  hi: { native: "हिन्दी", english: "Hindi", script: "Devanagari" },
  te: { native: "తెలుగు", english: "Telugu", script: "Telugu" },
  ta: { native: "தமிழ்", english: "Tamil", script: "Tamil" },
  kn: { native: "ಕನ್ನಡ", english: "Kannada", script: "Kannada" },
  ml: { native: "മലയാളം", english: "Malayalam", script: "Malayalam" },
  mr: { native: "मराठी", english: "Marathi", script: "Devanagari" },
  bn: { native: "বাংলা", english: "Bengali", script: "Bengali" },
  gu: { native: "ગુજરાતી", english: "Gujarati", script: "Gujarati" },
  pa: { native: "ਪੰਜਾਬੀ", english: "Punjabi", script: "Gurmukhi" },
  ar: { native: "العربية", english: "Arabic", script: "Arabic", rtl: true },
};

export default function GlobalLanguageSelector({
  className = "",
  variant = "default", // 'default' | 'light' | 'compact' | 'pill'
  align = "right", // 'left' | 'right'
}) {
  const { language, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const currentDetails = LANGUAGE_DETAILS[language] || LANGUAGE_DETAILS.en;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSelect(code) {
    if (code === language) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await setLanguage(code);
    } catch (err) {
      console.error("Language switch error:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  // Visual style variants
  const buttonStyles = {
    default:
      "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-2xs hover:border-slate-300",
    light:
      "bg-white/10 hover:bg-white/15 text-white border-white/20 shadow-2xs backdrop-blur-xs",
    compact:
      "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-2xs px-2 py-1 text-xs",
    pill:
      "bg-white/90 hover:bg-white text-slate-800 border-slate-200 shadow-sm rounded-full px-3 py-1 text-xs",
  };

  const isLight = variant === "light";

  return (
    <div ref={containerRef} className={`relative inline-block text-start ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
          buttonStyles[variant] || buttonStyles.default
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t("language")}: ${currentDetails.native}`}
        title={`${t("language")}: ${currentDetails.native} (${currentDetails.english})`}
      >
        {/* Globe icon */}
        <span className="text-sm leading-none shrink-0" aria-hidden="true">🌐</span>

        {/* Selected language name in native script */}
        <span className="truncate max-w-[100px] sm:max-w-[130px] font-medium">
          {currentDetails.native}
        </span>

        {/* RTL badge if Arabic */}
        {currentDetails.rtl && (
          <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-amber-500/15 text-amber-600">
            RTL
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-current opacity-60 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          role="listbox"
          aria-label={t("language")}
          className={`absolute z-50 mt-1.5 w-60 rounded-2xl bg-white shadow-xl border border-slate-200/90 py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100 ${
            align === "left" ? "start-0" : "end-0"
          }`}
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
              {t("language")}
            </p>
            <p className="text-[10px] text-slate-400">
              Select your preferred language
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {LANGUAGES.map(([code]) => {
              const info = LANGUAGE_DETAILS[code] || { native: code, english: code };
              const isSelected = code === language;
              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(code)}
                  disabled={saving}
                  className={`w-full flex items-center justify-between px-3 py-2 text-start transition ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50 font-normal"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">
                        {info.native}
                      </span>
                      {info.rtl && (
                        <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-amber-100 text-amber-800">
                          RTL
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {info.english}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="text-indigo-600 font-bold text-sm shrink-0 ms-2" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
