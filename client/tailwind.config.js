/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Svaadya Enterprise SaaS Design System - Attractive Blue & Purple Theme
        brand: {
          primary: "#4F46E5",    // Vibrant Indigo (Primary CTA & highlights)
          primaryDark: "#0F172A",// Midnight Navy (Sidebar & high-contrast surfaces)
          sidebarBg: "#111827",  // Rich Deep Slate / Midnight Indigo
          secondary: "#7C3AED",  // Royal Violet / Purple
          accent: "#6366F1",     // Electric Indigo Accent
          purple: "#8B5CF6",     // Vivid Purple
          lightPurple: "#F5F3FF",// Soft Purple 50
          mint: "#EEF2FF",       // Soft Indigo 50 badge & background
          light: "#EEF2FF",      // Soft Indigo 50
          dark: "#0F172A",       // Slate 900 Primary text
          muted: "#64748B",      // Slate 500 Secondary text
          subtle: "#94A3B8",     // Slate 400 Border & placeholders
          border: "#E2E8F0",     // Clean modern slate dividers
          bg: "#F8FAFC",         // Clean Slate-50 app background
          card: "#FFFFFF",       // Pure white card background
          success: "#10B981",    // Emerald
          warning: "#F59E0B",    // Amber
          danger: "#EF4444",     // Red
          info: "#3B82F6",       // Electric Blue
        },
        // Backwards compatibility aliases
        charcoal: "#0F172A",
        cream: "#F8FAFC",
        clove: "#4F46E5",
        marigold: "#7C3AED",
        marigolddark: "#1E1B4B",
        sage: "#10B981",
      },
      fontFamily: {
        sans: ["'Inter'", "'DM Sans'", "sans-serif"],
        display: ["'Fraunces'", "Georgia", "serif"],
        body: ["'Inter'", "'DM Sans'", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        panel: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        card: "0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)",
        elevated: "0 10px 25px -5px rgba(79, 70, 229, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        glow: "0 0 20px -3px rgba(99, 102, 241, 0.35)",
        purpleGlow: "0 0 20px -3px rgba(139, 92, 246, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
