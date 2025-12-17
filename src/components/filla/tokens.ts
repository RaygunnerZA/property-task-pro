/**
 * Filla Design System v4.0 - "Dimensional Paper Edition"
 * Token-based design system for tactile, neomorphic UI
 * SINGLE SOURCE OF TRUTH - use Tailwind classes instead where possible
 */

// === COLOR PALETTE (HSL) ===
export const colors = {
  // Primary Palette
  primary: '182 29% 63%',       // #8EC9CE - Teal
  primaryDeep: '182 23% 56%',   // #71AEB3 - Deep Teal
  primaryGlow: '182 35% 75%',   // Lighter teal for glows
  
  // Accent
  accent: '16 83% 56%',         // #EB6834 - Coral/Orange
  accentLight: '16 100% 95%',   // Light coral bg
  
  // Neutrals - Warm Paper Tones
  background: 'hsl(40, 20%, 94%)',     // #F1EEE8 - Warm beige
  surface: 'hsl(0, 0%, 100%)',         // #FFFFFF - Pure white
  surfaceRaised: 'hsl(40, 15%, 96%)',  // Slightly raised surface
  concrete: 'hsl(40, 12%, 88%)',       // #E3DFD7 - Border gray
  
  // Typography
  ink: 'hsl(248, 15%, 18%)',           // #2A293E - Dark purple-gray
  textMuted: 'hsl(40, 2%, 55%)',       // #8C8C85 - Muted gray
  textLight: 'hsl(40, 5%, 70%)',       // Light gray for captions
  
  // Status Colors
  danger: 'hsl(0, 84%, 60%)',          // #EF4444 - Red
  warning: 'hsl(43, 100%, 85%)',       // #FFE9B2 - Yellow
  success: 'hsl(145, 62%, 85%)',       // #C1F1D6 - Green
  signal: 'hsl(30, 100%, 91%)',        // #FFE4D0 - Warm signal orange
} as const;

// === NEUMORPHIC SHADOW PRESETS ===
export const neuShadows = {
  // Cards - Flat card with texture overlay
  flatCard: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)',
  
  // Sections - Flat section style
  flatSection: '-1px -1px 1px 0px rgba(0, 0, 0, 0.1), inset -1px -1px 1px rgba(255, 255, 255, 0.53)',
  
  // Engraved/pressed
  flatPressed: '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
  
  // Primary Buttons
  buttonOut: '3px 5px 5px 2px rgba(0, 0, 0, 0.13), -3px -3px 5px 0px rgba(255, 255, 255, 0.48), inset 1px 1px 2px 0px rgba(255, 255, 255, 0.5), inset -1px -2px 2px 0px rgba(0, 0, 0, 0.27)',
  buttonPressed: '0px 0px 7px 2px rgba(0, 0, 0, 0), inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)',
} as const;

// === TYPOGRAPHY ===
export const typography = {
  fontFamily: {
    sans: ['Inter Tight', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
  },
  
  // Text Variants
  headingXL: 'text-4xl font-bold tracking-tight leading-tight',
  headingL: 'text-2xl font-semibold tracking-tight leading-tight',
  headingM: 'text-lg font-semibold tracking-tight leading-snug',
  
  body: 'text-base leading-relaxed tracking-tight',
  label: 'text-[13px] font-semibold leading-normal',
  caption: 'text-xs leading-normal tracking-tight',
  mono: 'text-[11px] font-mono uppercase tracking-wide font-medium',
} as const;

// === SPACING & SIZING ===
export const spacing = {
  // Standard spacing scale (in px, but will be used via Tailwind)
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
} as const;

// === BORDER RADIUS ===
export const radii = {
  sharp: '5px',      // Core radius for buttons, chips, panels, calendar
  card: '8px',       // Card radius
  md: '8px',         // Modals, cards
  lg: '5px',         // Buttons
  pill: '9999px',    // Fully rounded
} as const;

// === SHADOWS ===
// Neomorphic/Paper depth system
export const shadows = {
  // E1 - Flat card with texture
  e1: neuShadows.flatCard,
  
  // E2 - Flat section style
  e2: neuShadows.flatSection,
  
  // E3 - Floating modals/popovers
  e3: '0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  
  // Engraved - Inset/debossed inputs
  engraved: neuShadows.flatPressed,
  
  // Paper Edge - White inner highlight
  paperEdge: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  
  // Button Shadows
  primaryBtn: neuShadows.buttonOut,
  btnPressed: neuShadows.buttonPressed,
  fab: '0 8px 24px rgba(235,104,52,0.4), 0 4px 8px rgba(235,104,52,0.3)',
  
  // Legacy compatibility
  outset: '0px 2px 6px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.04)',
  inset: 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)',
  card: '0px 4px 12px rgba(0,0,0,0.06), 0px 2px 4px rgba(0,0,0,0.04)',
  floating: '0px 12px 32px rgba(0,0,0,0.12), 0px 4px 12px rgba(0,0,0,0.08)',
} as const;

// === TRANSITIONS ===
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// === Z-INDEX SCALE ===
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
} as const;

// === COMPONENT CONSTANTS ===
export const components = {
  button: {
    height: {
      sm: '36px',
      md: '44px',
      lg: '52px',
    },
    minWidth: '44px', // Touch target minimum
  },
  
  input: {
    height: '44px',
    borderRadius: radii.sharp,
  },
  
  card: {
    borderRadius: radii.sharp,
  },
} as const;

// === BREAKPOINTS ===
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;
