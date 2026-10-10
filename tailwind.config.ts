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
        // Core backgrounds
        obsidian: "#0D0E10",
        surface: "#141518",
        elevated: "#1A1C20",
        border: "#292C31",
        // Text
        primary: "#F3F1EC",
        secondary: "#A6A8AD",
        muted: "#6F737A",
        // Module accents
        violet: {
          DEFAULT: "#7C3AED",
          muted: "#5B21B6",
          dim: "#2E1065",
          subtle: "#1E1030",
        },
        emerald: {
          DEFAULT: "#059669",
          muted: "#047857",
          dim: "#064E3B",
          subtle: "#022C22",
        },
        amber: {
          DEFAULT: "#B45309",
          muted: "#92400E",
          dim: "#451A03",
          subtle: "#1C0A00",
        },
        burgundy: {
          DEFAULT: "#9F1239",
          muted: "#881337",
          dim: "#4C0519",
          subtle: "#1F0A0D",
        },
        copper: {
          DEFAULT: "#C2410C",
          muted: "#9A3412",
          dim: "#431407",
          subtle: "#1A0800",
        },
        slate: {
          DEFAULT: "#64748B",
          muted: "#475569",
          dim: "#1E293B",
          subtle: "#0F172A",
        },
        rose: {
          DEFAULT: "#BE185D",
          muted: "#9D174D",
          dim: "#500724",
          subtle: "#200010",
        },
        sand: {
          DEFAULT: "#B5A48A",
          muted: "#8B7E65",
          dim: "#3D3528",
          subtle: "#1A1610",
        },
        magenta: {
          DEFAULT: "#A21CAF",
          muted: "#86198F",
          dim: "#3B0764",
          subtle: "#1A0529",
        },
        stone: {
          DEFAULT: "#57534E",
          muted: "#44403C",
          dim: "#1C1917",
          subtle: "#0C0A09",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "page-title": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "section-title": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "card-title": ["15px", { lineHeight: "1.4", fontWeight: "500" }],
        body: ["13px", { lineHeight: "1.5" }],
        meta: ["11px", { lineHeight: "1.4" }],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in-left": "slideInLeft 0.25s ease-out",
        "slide-in-right": "slideInRight 0.25s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "progress-fill": "progressFill 1.5s ease-out",
        "skeleton-pulse": "skeletonPulse 1.8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        progressFill: {
          "0%": { width: "0%" },
          "100%": { width: "var(--progress-width)" },
        },
        skeletonPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
