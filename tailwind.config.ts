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
        background: "#0d0b08",
        surface: "#1a1612",
        parchment: "#faf7f2",
        gold: "#c9a84c",
        goldLight: "#e8c96a",
        ash: "#6b6560",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-eb-garamond)", "Georgia", "serif"],
        label: ["var(--font-cinzel)", "serif"],
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
