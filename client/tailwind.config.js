/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Svaadya Enterprise SaaS Design System
        brand: {
          primary: "#004C46",    // Deep teal sidebar & primary CTA
          secondary: "#087F73",  // Secondary teal & active navigation
          accent: "#16A394",     // Interactive accent
          orange: "#D96724",     // Warm orange
          mint: "#E7F5F1",       // Light mint badge & backgrounds
          dark: "#172B2A",       // Primary text
          muted: "#788582",      // Secondary text
          subtle: "#9CA8A5",     // Border & placeholders
          border: "#E5ECE9",     // Clean dividers
          bg: "#F5F8F7",         // Main app background
          card: "#FFFFFF",       // Pure white card background
          success: "#269B67",    // Semantic success
          warning: "#E7A13A",    // Semantic warning
          danger: "#D95359",     // Semantic danger
          info: "#4285C5",       // Semantic info
        },
        // Backwards compatibility aliases
        charcoal: "#172B2A",
        cream: "#F5F8F7",
        clove: "#087F73",
        marigold: "#D96724",
        marigolddark: "#004C46",
        sage: "#269B67",
      },
      fontFamily: {
        sans: ["'Inter'", "'DM Sans'", "sans-serif"],
        display: ["'Fraunces'", "Georgia", "serif"],
        body: ["'Inter'", "'DM Sans'", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
        panel: "14px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 76, 70, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
        elevated: "0 10px 25px -5px rgba(0, 76, 70, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
