import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111110",
        lane: "#FFC500",
        "lane-soft": "#FFF4CC",
        go: "#0B6B4F",
        stop: "#B3261E",
        surface: "#F3F3F1",
        line: "#E4E4E1",
        muted: "#62625E",
        faint: "#8A8A84",
        land: "#EEEDE8",
        // shadcn compatibility (toasts, legacy primitives)
        background: "#FFFFFF",
        foreground: "#111110",
        border: "#E4E4E1",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        display: "-0.035em",
        tightish: "-0.015em",
      },
      boxShadow: {
        pop: "0 0 0 1px rgba(17,17,16,0.06), 0 20px 44px rgba(17,17,16,0.14)",
        float: "0 2px 10px rgba(17,17,16,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
