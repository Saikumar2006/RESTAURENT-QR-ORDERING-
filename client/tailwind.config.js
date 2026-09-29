/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Modern, minimal, near-monochrome palette with a single accent.
        charcoal: "#18181B", // primary text — neutral near-black, not warm brown
        cream: "#FAFAFA", // page background — soft off-white, not warm cream
        clove: "#2563EB", // primary accent (buttons, active states) — indigo
        marigold: "#3B82F6", // secondary accent, used at low opacity for tints
        marigolddark: "#1D4ED8", // focus rings / accent hover
        sage: "#16A34A", // status green (e.g. "veg" indicator)
      },
      fontFamily: {
        // A single modern sans-serif family for both display and body text
        // reads cleaner/more minimal than mixing a serif display face.
        display: ["'Manrope'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        card: "12px", // crisper corners than a very rounded "friendly" 18px
      },
    },
  },
  plugins: [],
};
