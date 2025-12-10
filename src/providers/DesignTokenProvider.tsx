/**
 * Unified Design Token System
 * Single source of truth for all design tokens with localStorage persistence
 * Sandboxes modify tokens → changes apply globally via CSS variables
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============= TOKEN DEFINITIONS =============

export interface ColorTokens {
  background: string;
  foreground: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ink: string;
  concrete: string;
  success: string;
  warning: string;
  destructive: string;
  signal: string;
}

export interface ShadowTokens {
  e1: string;
  e2: string;
  e3: string;
  engraved: string;
  primaryBtn: string;
  btnPressed: string;
  fab: string;
}

export interface TypographyTokens {
  fontSans: string;
  fontMono: string;
  headingXLShadow: string;
  headingLShadow: string;
}

export interface RadiusTokens {
  sharp: number;
  card: number;
  button: number;
  pill: number;
}

export interface ButtonTokens {
  primary: {
    background: string;
    text: string;
    shadow: string;
    shadowPressed: string;
    radius: number;
  };
  secondary: {
    background: string;
    text: string;
    shadow: string;
    shadowPressed: string;
    radius: number;
  };
  ghost: {
    background: string;
    text: string;
    shadow: string;
    shadowPressed: string;
    radius: number;
  };
  danger: {
    background: string;
    text: string;
    shadow: string;
    shadowPressed: string;
    radius: number;
  };
}

export interface ChipTokens {
  filter: {
    activeBackground: string;
    activeText: string;
    inactiveBackground: string;
    inactiveText: string;
    radius: number;
    shadow: string;
  };
}

export interface SegmentTokens {
  trackBackground: string;
  trackRadius: number;
  trackShadow: string;
  buttonBackground: string;
  buttonText: string;
  buttonRadius: number;
  activeBackground: string;
  activeText: string;
  activeShadow: string;
}

export interface CalendarTokens {
  cellRadius: number;
  cellSize: number;
  gap: number;
  heatLow: string;
  heatMed: string;
  heatHigh: string;
  heatLowOpacity: number;
  heatMedOpacity: number;
  heatHighOpacity: number;
  titleFont: string;
  weekdayFont: string;
  dateFont: string;
  titleWeight: number;
  weekdayWeight: number;
  dateWeight: number;
}

export interface DesignTokens {
  colors: ColorTokens;
  shadows: ShadowTokens;
  typography: TypographyTokens;
  radii: RadiusTokens;
  buttons: ButtonTokens;
  chips: ChipTokens;
  segments: SegmentTokens;
  calendar: CalendarTokens;
}

// ============= DEFAULT VALUES =============

export const defaultTokens: DesignTokens = {
  colors: {
    background: '40 20% 94%',
    foreground: '248 15% 18%',
    primary: '182 29% 63%',
    primaryDeep: '182 23% 56%',
    accent: '16 83% 56%',
    muted: '40 12% 92%',
    mutedForeground: '40 2% 55%',
    border: '40 12% 88%',
    ink: '248 15% 18%',
    concrete: '40 12% 88%',
    success: '145 62% 85%',
    warning: '43 100% 85%',
    destructive: '0 84% 60%',
    signal: '30 100% 91%',
  },
  shadows: {
    e1: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)',
    e2: '-1px -1px 1px 0px rgba(0, 0, 0, 0.1), inset -1px -1px 1px rgba(255, 255, 255, 0.53)',
    e3: '0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
    engraved: '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
    primaryBtn: '3px 5px 5px 2px rgba(0, 0, 0, 0.13), -3px -3px 5px 0px rgba(255, 255, 255, 0.48), inset 1px 1px 2px 0px rgba(255, 255, 255, 0.5), inset -1px -2px 2px 0px rgba(0, 0, 0, 0.27)',
    btnPressed: '0px 0px 7px 2px rgba(0, 0, 0, 0), inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)',
    fab: '0 8px 24px rgba(235,104,52,0.4), 0 4px 8px rgba(235,104,52,0.3)',
  },
  typography: {
    fontSans: "'Inter Tight', system-ui, -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
    headingXLShadow: '2px 2px 3px rgba(255, 255, 255, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.15)',
    headingLShadow: '1px 1px 2px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(0, 0, 0, 0.1)',
  },
  radii: {
    sharp: 5,
    card: 8,
    button: 5,
    pill: 9999,
  },
  buttons: {
    primary: {
      background: '#8EC9CE',
      text: '#FFFFFF',
      shadow: '3px 5px 7px 2px rgba(0, 0, 0, 0.06), -4px -5px 11px 4px rgba(255, 255, 255, 0.52), inset 2px 2px 0px 0px rgba(255, 255, 255, 0), inset -2px -3px 4px 0px rgba(0, 0, 0, 0.06)',
      shadowPressed: '0px 0px 7px 2px rgba(0, 0, 0, 0.01), inset -3px -9px 17px 0px rgba(255, 255, 255, 0.49), inset 1px 13px 19px 0px rgba(0, 0, 0, 0.09)',
      radius: 5,
    },
    secondary: {
      background: '#F1EEE8',
      text: '#2C2C2C',
      shadow: '2px 6px 5px -3px rgba(0, 0, 0, 0.07), -2px -2px 8px -3px rgba(255, 255, 255, 0.19), inset 0px -2px 2px 0px rgba(0, 0, 0, 0.1), inset 1px 2px 2px 0px rgba(255, 255, 255, 1)',
      shadowPressed: '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
      radius: 5,
    },
    ghost: {
      background: 'transparent',
      text: '#2C2C2C',
      shadow: 'none',
      shadowPressed: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      radius: 5,
    },
    danger: {
      background: '#FEE2E2',
      text: '#DC2626',
      shadow: '2px 4px 8px -2px rgba(239, 68, 68, 0.3), -2px -2px 6px -2px rgba(255, 255, 255, 0.4)',
      shadowPressed: 'inset 0 2px 6px rgba(239, 68, 68, 0.2)',
      radius: 5,
    },
  },
  chips: {
    filter: {
      activeBackground: '#8EC9CE',
      activeText: '#FFFFFF',
      inactiveBackground: '#F1EEE8',
      inactiveText: '#6F6F6F',
      radius: 5,
      shadow: '2px 3px 5px -2px rgba(0, 0, 0, 0.08), -2px -2px 5px -2px rgba(255, 255, 255, 0.6), inset 0px -1px 1px 0px rgba(0, 0, 0, 0.05)',
    },
  },
  segments: {
    trackBackground: '#E8E5DF',
    trackRadius: 10,
    trackShadow: 'inset 2px 2px 4px rgba(0, 0, 0, 0.1), inset -2px -2px 4px rgba(255, 255, 255, 0.7)',
    buttonBackground: 'transparent',
    buttonText: '#6F6F6F',
    buttonRadius: 8,
    activeBackground: '#FFFFFF',
    activeText: '#1A1A1A',
    activeShadow: '2px 2px 6px rgba(0,0,0,0.1)',
  },
  calendar: {
    cellRadius: 12,
    cellSize: 40,
    gap: 4,
    heatLow: '182 29% 75%',
    heatMed: '182 29% 63%',
    heatHigh: '182 23% 50%',
    heatLowOpacity: 0.4,
    heatMedOpacity: 0.7,
    heatHighOpacity: 1,
    titleFont: "'Inter Tight', sans-serif",
    weekdayFont: "'JetBrains Mono', monospace",
    dateFont: "'JetBrains Mono', monospace",
    titleWeight: 600,
    weekdayWeight: 500,
    dateWeight: 500,
  },
};

// ============= STORAGE KEY =============
const STORAGE_KEY = 'filla-design-tokens-v1';

// ============= CONTEXT =============

interface DesignTokenContextValue {
  tokens: DesignTokens;
  setToken: <K extends keyof DesignTokens>(category: K, key: keyof DesignTokens[K], value: any) => void;
  setTokens: <K extends keyof DesignTokens>(category: K, values: Partial<DesignTokens[K]>) => void;
  resetTokens: (category?: keyof DesignTokens) => void;
  resetAll: () => void;
  commitTokens: () => void;
  hasChanges: boolean;
}

const DesignTokenContext = createContext<DesignTokenContextValue | null>(null);

// ============= PROVIDER =============

interface DesignTokenProviderProps {
  children: ReactNode;
}

export function DesignTokenProvider({ children }: DesignTokenProviderProps) {
  const [tokens, setTokensState] = useState<DesignTokens>(() => {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Deep merge with defaults to handle new properties
          return deepMerge(defaultTokens, parsed);
        } catch {
          return defaultTokens;
        }
      }
    }
    return defaultTokens;
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Inject CSS variables whenever tokens change
  useEffect(() => {
    injectCSSVariables(tokens);
  }, [tokens]);

  // Set a single token value
  const setToken = useCallback(<K extends keyof DesignTokens>(
    category: K,
    key: keyof DesignTokens[K],
    value: any
  ) => {
    setTokensState(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  }, []);

  // Set multiple token values in a category
  const setTokens = useCallback(<K extends keyof DesignTokens>(
    category: K,
    values: Partial<DesignTokens[K]>
  ) => {
    setTokensState(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...values,
      },
    }));
    setHasChanges(true);
  }, []);

  // Reset a category or all tokens
  const resetTokens = useCallback((category?: keyof DesignTokens) => {
    if (category) {
      setTokensState(prev => ({
        ...prev,
        [category]: defaultTokens[category],
      }));
    }
    setHasChanges(true);
  }, []);

  const resetAll = useCallback(() => {
    setTokensState(defaultTokens);
    localStorage.removeItem(STORAGE_KEY);
    setHasChanges(false);
  }, []);

  // Commit/save to localStorage
  const commitTokens = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    setHasChanges(false);
    // Dispatch event for any components listening
    window.dispatchEvent(new CustomEvent('filla-tokens-committed', { detail: tokens }));
  }, [tokens]);

  return (
    <DesignTokenContext.Provider value={{ tokens, setToken, setTokens, resetTokens, resetAll, commitTokens, hasChanges }}>
      {children}
    </DesignTokenContext.Provider>
  );
}

// ============= HOOK =============

export function useDesignTokens() {
  const context = useContext(DesignTokenContext);
  if (!context) {
    throw new Error('useDesignTokens must be used within DesignTokenProvider');
  }
  return context;
}

// ============= UTILITIES =============

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] as any, source[key] as any);
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any;
    }
  }
  return result;
}

function injectCSSVariables(tokens: DesignTokens) {
  const root = document.documentElement;

  // Colors
  root.style.setProperty('--background', tokens.colors.background);
  root.style.setProperty('--foreground', tokens.colors.foreground);
  root.style.setProperty('--primary', tokens.colors.primary);
  root.style.setProperty('--primary-deep', tokens.colors.primaryDeep);
  root.style.setProperty('--accent', tokens.colors.accent);
  root.style.setProperty('--muted', tokens.colors.muted);
  root.style.setProperty('--muted-foreground', tokens.colors.mutedForeground);
  root.style.setProperty('--border', tokens.colors.border);
  root.style.setProperty('--ink', tokens.colors.ink);
  root.style.setProperty('--concrete', tokens.colors.concrete);
  root.style.setProperty('--success', tokens.colors.success);
  root.style.setProperty('--warning', tokens.colors.warning);
  root.style.setProperty('--destructive', tokens.colors.destructive);
  root.style.setProperty('--signal', tokens.colors.signal);

  // Radii
  root.style.setProperty('--radius-sharp', `${tokens.radii.sharp}px`);
  root.style.setProperty('--radius-card', `${tokens.radii.card}px`);
  root.style.setProperty('--radius-button', `${tokens.radii.button}px`);

  // Typography
  root.style.setProperty('--font-sans', tokens.typography.fontSans);
  root.style.setProperty('--font-mono', tokens.typography.fontMono);
  root.style.setProperty('--heading-xl-shadow', tokens.typography.headingXLShadow);
  root.style.setProperty('--heading-l-shadow', tokens.typography.headingLShadow);

  // Shadows (as custom properties for use in Tailwind or inline)
  root.style.setProperty('--shadow-e1', tokens.shadows.e1);
  root.style.setProperty('--shadow-e2', tokens.shadows.e2);
  root.style.setProperty('--shadow-e3', tokens.shadows.e3);
  root.style.setProperty('--shadow-engraved', tokens.shadows.engraved);
  root.style.setProperty('--shadow-primary-btn', tokens.shadows.primaryBtn);
  root.style.setProperty('--shadow-btn-pressed', tokens.shadows.btnPressed);
  root.style.setProperty('--shadow-fab', tokens.shadows.fab);

  // Button tokens
  root.style.setProperty('--btn-primary-bg', tokens.buttons.primary.background);
  root.style.setProperty('--btn-primary-text', tokens.buttons.primary.text);
  root.style.setProperty('--btn-primary-shadow', tokens.buttons.primary.shadow);
  root.style.setProperty('--btn-primary-shadow-pressed', tokens.buttons.primary.shadowPressed);
  root.style.setProperty('--btn-primary-radius', `${tokens.buttons.primary.radius}px`);

  root.style.setProperty('--btn-secondary-bg', tokens.buttons.secondary.background);
  root.style.setProperty('--btn-secondary-text', tokens.buttons.secondary.text);
  root.style.setProperty('--btn-secondary-shadow', tokens.buttons.secondary.shadow);
  root.style.setProperty('--btn-secondary-radius', `${tokens.buttons.secondary.radius}px`);

  // Chips
  root.style.setProperty('--chip-filter-active-bg', tokens.chips.filter.activeBackground);
  root.style.setProperty('--chip-filter-active-text', tokens.chips.filter.activeText);
  root.style.setProperty('--chip-filter-inactive-bg', tokens.chips.filter.inactiveBackground);
  root.style.setProperty('--chip-filter-inactive-text', tokens.chips.filter.inactiveText);
  root.style.setProperty('--chip-filter-radius', `${tokens.chips.filter.radius}px`);
  root.style.setProperty('--chip-filter-shadow', tokens.chips.filter.shadow);

  // Segments
  root.style.setProperty('--segment-track-bg', tokens.segments.trackBackground);
  root.style.setProperty('--segment-track-radius', `${tokens.segments.trackRadius}px`);
  root.style.setProperty('--segment-track-shadow', tokens.segments.trackShadow);
  root.style.setProperty('--segment-button-bg', tokens.segments.buttonBackground);
  root.style.setProperty('--segment-button-text', tokens.segments.buttonText);
  root.style.setProperty('--segment-button-radius', `${tokens.segments.buttonRadius}px`);
  root.style.setProperty('--segment-active-bg', tokens.segments.activeBackground);
  root.style.setProperty('--segment-active-text', tokens.segments.activeText);
  root.style.setProperty('--segment-active-shadow', tokens.segments.activeShadow);

  // Calendar
  root.style.setProperty('--calendar-cell-radius', `${tokens.calendar.cellRadius}px`);
  root.style.setProperty('--calendar-cell-size', `${tokens.calendar.cellSize}px`);
  root.style.setProperty('--calendar-gap', `${tokens.calendar.gap}px`);
  root.style.setProperty('--calendar-heat-low', tokens.calendar.heatLow);
  root.style.setProperty('--calendar-heat-med', tokens.calendar.heatMed);
  root.style.setProperty('--calendar-heat-high', tokens.calendar.heatHigh);
  root.style.setProperty('--calendar-title-font', tokens.calendar.titleFont);
  root.style.setProperty('--calendar-weekday-font', tokens.calendar.weekdayFont);
  root.style.setProperty('--calendar-date-font', tokens.calendar.dateFont);
}
