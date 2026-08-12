import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#1A73E8",
          dark: "#1557B0",
          light: "#4C94F7",
          soft: "#E8F0FE",
        },
        status: {
          operational: "#1E8E3E",
          limited: "#F9AB00",
          offline: "#D93025",
          unknown: "#5F6368",
        },
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#1F1F1F",
          muted: "#5F6368",
          faint: "#80868B",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        floating:
          "0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)",
        elevated:
          "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
        sheet: "0 -2px 12px 0 rgba(60,64,67,0.2)",
      },
      fontFamily: {
        sans: [
          "Google Sans",
          "Roboto",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        "slide-up": "slide-up 0.28s cubic-bezier(0.2, 0, 0, 1)",
        "fade-in": "fade-in 0.18s ease-out",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
