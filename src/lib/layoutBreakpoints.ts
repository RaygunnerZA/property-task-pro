/**
 * Canonical layout breakpoints (keep in sync with `tailwind.config.ts` `theme.extend.screens`
 * and `useIsMobile` / `useIsBelowMd` in `hooks/use-mobile.tsx`).
 *
 * See `Docs/04_UI_System.md` §4.2 and `lib/workbenchLayoutMode.ts` for presentation rules:
 * - `sm` / `workbenchTwoColumn` (640px): default hub dual-pane (left | centre).
 * - `phone` / Tailwind `md` (768px): nav-driven phone mode — home is left/scope only;
 *   `/tasks` is full-screen centre (Inflow | Tasks | Calendar). Prefer this over ad-hoc sm/md mixes.
 * - `sidebarRail` / Tailwind `md` (768px): persistent condensed nav rail vs offcanvas + bottom nav.
 * - `workspace` (1100px): property hub modules (three columns).
 * - `layout` (1280px): app shell three-column dashboard / property right rail.
 *   Sized for common laptop CSS widths (13″ Retina ~1440, 1366×768, 1280×800), not only large desktops.
 * - `max-pane`: max-width query for very narrow inner panes (task rail density).
 */
export const LAYOUT_BREAKPOINTS = {
  /** Narrow inner panes (task rail, tight padding) */
  maxPane: 455,
  /** Hub: calendar/properties column beside tasks from this min-width (Tailwind `sm`, 640px). */
  workbenchTwoColumn: 640,
  /**
   * Phone / nav-driven workbench (Tailwind `md`, 768px).
   * Below: home shows property/portfolio chrome only; `/tasks` is centre-only.
   * At/above: DualPane dual-column grid applies even on home-hub.
   */
  phone: 768,
  /**
   * App nav rail: below this width the sidebar is an offcanvas sheet + bottom nav (Tailwind `md`, 768px).
   * At/above: condensed icon rail with hover-expand — tablets and desktop.
   */
  sidebarRail: 768,
  /** Property workspace / compliance: stacked → three-column */
  workspace: 1100,
  /**
   * App shell: two-column tablet → three-column desktop.
   * 1280 fits default 13″ laptop scaling and most Windows laptop widths; rails flex via
   * `grid-cols-workbench-triple` minmax tracks so the third column does not force overflow.
   * DualPaneLayout adds `column-gap: var(--gutter-rail)` between tracks so centre cards
   * and the detail pane cannot paint into each other when OS display scaling is not 100%.
   * Horizontal clipping on the centre grid cell uses `overflow-x: clip` (not hidden) so
   * it does not force a vertical scrollbar onto the column seam.
   */
  layout: 1280,
} as const;

/** Hub left / right rails on desktop (DualPaneLayout, WorkbenchGradientHeader). */
export const WORKBENCH_SIDE_RAIL_PX = 330;

/** Soft minimum for side rails when the triple grid must compress on smaller laptops. */
export const WORKBENCH_SIDE_RAIL_MIN_PX = 260;

/** Hub / workbench middle column max width (DualPaneLayout, PropertyScreenLayout, etc.) */
export const WORK_SURFACE_MAX_PX = 700;

/** Soft minimum for the centre track when the triple grid compresses. */
export const WORK_SURFACE_MIN_PX = 420;

/** Property workspace action / AI rail max width beside the work surface */
export const WORKSPACE_ACTION_RAIL_MAX_PX = 280;

/** Content width inside work surface after `px-1` (4px × 2) gutters */
export const WORK_SURFACE_CONTENT_MAX_PX = WORK_SURFACE_MAX_PX - 8;
