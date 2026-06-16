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
        // Warm sand & clay — soft, light, inviting (replaces the old dark/gold).
        background: "#f6f0e6", // warm cream page background
        surface: "#ffffff", // cards, inputs, panels
        parchment: "#3a2e20", // primary text (warm deep brown)
        gold: "#a85c36", // accent (soft clay/terracotta)
        goldLight: "#c67b4d", // accent hover (lighter clay)
        ash: "#786652", // muted text (warm taupe)
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
