import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#142D3A", 700: "#1D3F50", 600: "#2A5468" },
        teal: { DEFAULT: "#167C70", 600: "#126A60", 100: "#D3ECE7" },
        mint: "#E8F4F0",
        cloud: "#F7F9FA",
        amber: { DEFAULT: "#D99A36", 100: "#FAEFD9" },
        danger: { DEFAULT: "#C94C55", 100: "#F8E1E3" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,45,58,0.04), 0 8px 24px rgba(20,45,58,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
