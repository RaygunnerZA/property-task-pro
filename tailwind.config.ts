import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter Tight', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          deep: "hsl(var(--primary-deep))",
        },
        concrete: "hsl(var(--concrete))",
        ink: "hsl(var(--ink))",
        signal: {
          DEFAULT: "hsl(var(--signal))",
          foreground: "hsl(var(--signal-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Surface gradient colors (from compliance dashboard)
        "surface-gradient": {
          from: "hsl(40, 15%, 95%)",  // #F4F3F0
          via: "hsl(40, 12%, 93%)",   // #F2F1ED
          to: "hsl(40, 10%, 91%)",    // #EFEDE9
        },
        // Input background color
        "input-bg": "hsl(40, 10%, 96%)", // #F6F4F2
      },
      backgroundImage: {
        "surface-gradient": "linear-gradient(to bottom right, hsl(40, 15%, 95%), hsl(40, 12%, 93%), hsl(40, 10%, 91%))",
        "surface-gradient-horizontal": "linear-gradient(to right, hsl(40, 15%, 95%), hsl(40, 12%, 93%), hsl(40, 10%, 91%))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        sharp: "5px",   // Filla core radius - buttons, chips, panels, calendar
        card: "8px",    // Filla card radius
        button: "5px",  // Filla button radius
      },
      boxShadow: {
        'e1': '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)',
        'e2': '-1px -1px 1px 0px rgba(0, 0, 0, 0.1), inset -1px -1px 1px rgba(255, 255, 255, 0.53)',
        'e3': '0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        'engraved': '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
        'paper-edge': 'inset 0 1px 0 rgba(255,255,255,0.8)',
        'primary-btn': '3px 5px 5px 2px rgba(0, 0, 0, 0.13), -3px -3px 5px 0px rgba(255, 255, 255, 0.48), inset 1px 1px 2px 0px rgba(255, 255, 255, 0.5), inset -1px -2px 2px 0px rgba(0, 0, 0, 0.27)',
        'btn-pressed': '0px 0px 7px 2px rgba(0, 0, 0, 0), inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)',
        'fab': '0 8px 24px rgba(235,104,52,0.4), 0 4px 8px rgba(235,104,52,0.3)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
        "slide-out-left": {
          "0%": {
            opacity: "1",
            transform: "translateX(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateX(-20px)",
          },
        },
        "slide-out-right": {
          "0%": {
            opacity: "1",
            transform: "translateX(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateX(20px)",
          },
        },
        "chip-slide-in": {
          "0%": {
            opacity: "0",
            transform: "translateX(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "chip-slide-out": {
          "0%": {
            opacity: "1",
            transform: "translateX(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateX(10px)",
          },
        },
        "wipe-right-to-left": {
          "0%": {
            opacity: "0",
            transform: "translateX(100%)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "wipe-left-to-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(-100%)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-out-left": "slide-out-left 0.15s ease-out",
        "slide-out-right": "slide-out-right 0.15s ease-out",
        "chip-slide-in": "chip-slide-in 0.2s ease-out",
        "chip-slide-out": "chip-slide-out 0.15s ease-in",
        "wipe-right-to-left": "wipe-right-to-left 0.3s ease-out",
        "wipe-left-to-right": "wipe-left-to-right 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
