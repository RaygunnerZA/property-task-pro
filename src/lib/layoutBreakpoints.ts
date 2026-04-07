/**
 * Canonical layout breakpoints (keep in sync with `tailwind.config.ts` `theme.extend.screens`).
 * Use for dev tools readouts and any JS that mirrors CSS breakpoints.
 *
 * See `Docs/04_UI_System.md` → “Breakpoints (canonical)” for when to use each name:
 * - `sm` (640px): hub dual-pane (calendar/properties | tasks) — see `workbenchTwoColumn`.
 * - `sidebarRail` / Tailwind `lg` (1024px): persistent app nav rail vs offcanvas drawer.
 * - `workspace`: property hub modules (three columns).
 * - `layout`: app shell three-column dashboard / property right rail.
 * - `max-pane`: max-width query for very narrow inner panes (task rail density).
 */
export const LAYOUT_BREAKPOINTS = {
  /** Narrow inner panes (task rail, tight padding) */
  maxPane: 455,
  /** Hub: calendar/properties column beside tasks from this min-width (Tailwind `sm`, 640px). */
  workbenchTwoColumn: 640,
  /**
   * App nav rail: below this width the sidebar is an offcanvas sheet + top bar (Tailwind `lg`, 1024px).
   * Wider than this, the persistent left rail shows — independent of hub column stacking.
   */
  sidebarRail: 1024,
  /** Property workspace / compliance: stacked → three-column */
  workspace: 1100,
  /** App shell: two-column tablet → three-column desktop */
  layout: 1380,
} as const;
