import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";

const THEME_STORAGE_KEY = "svaadya_theme";
const VALID_THEMES = ["light", "dark", "system"];

const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  isDark: false,
  toggleTheme: () => {},
});

function getSystemPreference() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored)) return stored;
  } catch {
    // Ignore localStorage errors
  }
  return "system";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const [systemPreference, setSystemPreference] = useState(getSystemPreference);

  // Computed effective theme ("light" | "dark")
  const resolvedTheme = useMemo(() => {
    return theme === "system" ? systemPreference : theme;
  }, [theme, systemPreference]);

  const isDark = resolvedTheme === "dark";

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // System color-scheme listener
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.includes(nextTheme)) return;
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, [setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      isDark,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, isDark, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Reusable Apple Pro Theme Segmented Control
 */
export function AppleThemeToggle({ className = "", size = "md" }) {
  const { theme, setTheme, isDark } = useTheme();

  const isCompact = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode"
      className={`inline-flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/[0.04] dark:border-white/[0.06] backdrop-blur-apple transition ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        onClick={() => setTheme("light")}
        title="Light theme"
        className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ${
          isCompact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"
        } ${
          theme === "light"
            ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
            : "text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white"
        }`}
      >
        <span className="text-xs">☀️</span>
        {!isCompact && <span>Light</span>}
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        onClick={() => setTheme("dark")}
        title="Dark theme"
        className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ${
          isCompact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"
        } ${
          theme === "dark"
            ? "bg-[#2C2C2E] text-white shadow-xs font-semibold"
            : "text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white"
        }`}
      >
        <span className="text-xs">🌙</span>
        {!isCompact && <span>Dark</span>}
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === "system"}
        onClick={() => setTheme("system")}
        title="System auto theme"
        className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ${
          isCompact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"
        } ${
          theme === "system"
            ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white shadow-xs font-semibold"
            : "text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white"
        }`}
      >
        <span className="text-xs">💻</span>
        {!isCompact && <span>Auto</span>}
      </button>
    </div>
  );
}
