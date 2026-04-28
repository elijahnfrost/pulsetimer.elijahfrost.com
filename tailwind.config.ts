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
        ds: {
          page: "var(--color-bg-page)",
          fg: "var(--color-fg)",
          bright: "var(--color-fg-bright)",
          muted: "var(--color-fg-muted)",
          dim: "var(--color-fg-dim)",
          soft: "var(--color-fg-soft)",
          body: "var(--color-fg-body)",
          label: "var(--color-label)",
          border: "var(--color-border)",
          hover: "var(--color-border-hover)",
          section: "var(--color-border-section)",
          divider: "var(--color-border-divider)",
          chrome: "var(--color-chrome-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "Georgia", "ui-serif"],
        display: ["var(--font-cormorant)", "Georgia", "ui-serif"],
      },
      transitionDuration: {
        ds: "120ms",
      },
      transitionTimingFunction: {
        "ds-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
