import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Tight", "system-ui", "sans-serif"],
        display: ["Inter Tight", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        paper: "hsl(var(--paper))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          deep: "hsl(var(--primary-deep))",
        },
        coral: "hsl(var(--coral))",
        card: "hsl(var(--card))",
      },
      boxShadow: {
        e1: "1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)",
        e3: "0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        engraved:
          "3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)",
        "primary-btn":
          "3px 5px 5px 2px rgba(0, 0, 0, 0.13), -3px -3px 5px 0px rgba(255, 255, 255, 0.48), inset 1px 1px 2px 0px rgba(255, 255, 255, 0.5), inset -1px -2px 2px 0px rgba(0, 0, 0, 0.27)",
        "btn-pressed":
          "0px 0px 7px 2px rgba(0, 0, 0, 0), inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)",
      },
    },
  },
  plugins: [],
} satisfies Config;
