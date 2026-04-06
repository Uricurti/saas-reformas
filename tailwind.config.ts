import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ReforLife brand — Azul principal
        primary: {
          DEFAULT:    "#607eaa",
          light:      "#EEF2F8",
          dark:       "#1c3879",
          foreground: "#FFFFFF",
        },
        // Turquesa — acento CTA
        accent: {
          DEFAULT:    "#26bbec",
          light:      "#E8F8FD",
          dark:       "#1099C8",
          foreground: "#FFFFFF",
        },
        // App backgrounds — Apple light
        app: {
          bg:      "#F5F4F1",   // crema muy suave (tono marca)
          card:    "#FFFFFF",
          sidebar: "#FFFFFF",
        },
        // Textos
        content: {
          primary:   "#1A1A2E",
          secondary: "#4A5568",
          muted:     "#94A3B8",
        },
        // Estados
        success: {
          DEFAULT:    "#10B981",
          light:      "#D1FAE5",
          foreground: "#065F46",
        },
        danger: {
          DEFAULT:    "#EF4444",
          light:      "#FEE2E2",
          foreground: "#991B1B",
        },
        warning: {
          DEFAULT:    "#F59E0B",
          light:      "#FEF3C7",
          foreground: "#92400E",
        },
        // Bordes sutiles estilo Apple
        border: {
          DEFAULT: "#E8E8EC",
          light:   "#F2F2F5",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title":     ["1.5rem",   { lineHeight: "2rem",   fontWeight: "700" }],
        "section-header": ["1.125rem", { lineHeight: "1.75rem",fontWeight: "600" }],
        body:             ["0.875rem", { lineHeight: "1.25rem",fontWeight: "400" }],
        label:            ["0.75rem",  { lineHeight: "1rem",   fontWeight: "500" }],
        caption:          ["0.75rem",  { lineHeight: "1rem",   fontWeight: "400" }],
      },
      borderRadius: {
        card:   "16px",
        button: "10px",
        input:  "10px",
        badge:  "9999px",
        icon:   "12px",
      },
      boxShadow: {
        // Apple-style shadows: muy sutiles, ligeramente con color
        card:     "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 20px rgba(96,126,170,0.15), 0 1px 4px rgba(0,0,0,0.08)",
        modal:    "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
        dropdown: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        input:    "0 0 0 3px rgba(96,126,170,0.15)",
        "input-accent": "0 0 0 3px rgba(38,187,236,0.20)",
      },
      width: { sidebar: "260px" },
      height: {
        header:    "64px",
        bottomnav: "66px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        bottomnav: "66px",
      },
      animation: {
        "fade-in":  "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scaleIn 0.15s ease-out",
        "check":    "check 0.2s ease-out",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity:"0" },             "100%": { opacity:"1" } },
        slideUp: { "0%": { transform:"translateY(12px)",opacity:"0" }, "100%": { transform:"translateY(0)",opacity:"1" } },
        scaleIn: { "0%": { transform:"scale(0.96)",opacity:"0" }, "100%": { transform:"scale(1)",opacity:"1" } },
        check:   { "0%": { transform:"scale(0.8)" }, "50%": { transform:"scale(1.1)" }, "100%": { transform:"scale(1)" } },
      },
    },
  },
  plugins: [],
};
export default config;
