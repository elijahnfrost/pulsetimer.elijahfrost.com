import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pulse: {
          bg: "var(--pulse-bg)",
          surface: "var(--pulse-surface)",
          border: "var(--pulse-border)",
          text: "var(--pulse-text)",
          muted: "var(--pulse-text-secondary)",
          accent: "var(--pulse-accent)",
          alert: "var(--pulse-alert)",
          success: "var(--pulse-success)",
        },
      },
      boxShadow: {
        "accent-glow": "0 0 0 3px rgba(108, 99, 255, 0.2)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
