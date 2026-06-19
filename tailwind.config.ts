import type { Config } from "tailwindcss";

// Anima Temple platform theme — shares the brand palette/fonts with the
// Divine Blueprint product so the family feels cohesive.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Clean, calm workspace — neutral surfaces + a single sage accent (the chrome
        // stays quiet so the user's own design is the colourful part). Token names kept
        // ('gold'/'parchment'/'ash') so existing classes pick up the new palette.
        background: "#f4f5f3", // light neutral page background
        surface: "#ffffff", // cards, inputs, panels
        parchment: "#2b2f33", // primary text (slate ink)
        gold: "#67905d", // accent (sage green)
        goldLight: "#79a36b", // accent hover (lighter sage)
        ash: "#8a8f98", // muted text (neutral grey)
      },
      fontFamily: {
        // Resolve through generic vars so a site can swap its typography by setting
        // --font-display / --font-body / --font-label on its wrapper (see globals.css
        // for the defaults used everywhere else).
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        label: ["var(--font-label)"],
      },
      animation: {
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
      },
      keyframes: {
        pulseGold: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
