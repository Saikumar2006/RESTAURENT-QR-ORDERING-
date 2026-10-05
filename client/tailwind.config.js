/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Modern, minimal, near-monochrome palette with a single accent.
        charcoal: "#202925",
        cream: "#F4F6F3",
        clove: "#087F70",
        marigold: "#D78A4B",
        marigolddark: "#08685D",
        sage: "#25845D",
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
      borderRadius: {
        card: "7px",
      },
    },
  },
  plugins: [],
};
