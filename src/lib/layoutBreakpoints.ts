/**
 * Canonical layout breakpoints (keep in sync with tailwind.config.ts theme.extend.screens).
 * Use for dev tools readouts and any JS that mirrors CSS breakpoints.
 */
export const LAYOUT_BREAKPOINTS = {
  /** Narrow inner panes (task rail, tight padding) */
  maxPane: 455,
  /** Property workspace / compliance: stacked → three-column */
  workspace: 1100,
  /** App shell: two-column tablet → three-column desktop */
  layout: 1380,
} as const;
