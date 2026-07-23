/**
 * Canonical layout breakpoints (keep in sync with `tailwind.config.ts` `theme.extend.screens`
 * and `useIsMobile` / `useIsBelowMd` in `hooks/use-mobile.tsx`).
 *
 * See `Docs/04_UI_System.md` §4.2 and `lib/workbenchLayoutMode.ts` for presentation rules:
 * - `sm` / `workbenchTwoColumn` (640px): default hub dual-pane (left | centre).
 * - `phone` / Tailwind `md` (768px): nav-driven phone mode — home-hub collapses centre;
 *   work-surface keeps a full-screen centre. Prefer this over ad-hoc sm/md mixes.
 * - `sidebarRail` / Tailwind `lg` (1024px): persistent app nav rail vs offcanvas + bottom nav.
 * - `workspace` (1100px): property hub modules (three columns).
 * - `layout` (1480px): app shell three-column dashboard / property right rail.
 * - `max-pane`: max-width query for very narrow inner panes (task rail density).
 */
export const LAYOUT_BREAKPOINTS = {
  /** Narrow inner panes (task rail, tight padding) */
  maxPane: 455,
  /** Hub: calendar/properties column beside tasks from this min-width (Tailwind `sm`, 640px). */
  workbenchTwoColumn: 640,
  /**
   * Phone / nav-driven workbench (Tailwind `md`, 768px).
   * Below: home-hub is scope-only; work surfaces are full-screen routes.
   * At/above: DualPane dual-column grid applies even on home-hub.
   */
  phone: 768,
  /**
   * App nav rail: below this width the sidebar is an offcanvas sheet + top bar (Tailwind `lg`, 1024px).
   * Wider than this, the persistent left rail shows — independent of hub column stacking.
   */
  sidebarRail: 1024,
  /** Property workspace / compliance: stacked → three-column */
  workspace: 1100,
  /** App shell: two-column tablet → three-column desktop */
  layout: 1480,
} as const;

/** Hub left / right rails on desktop (DualPaneLayout, WorkbenchGradientHeader). */
export const WORKBENCH_SIDE_RAIL_PX = 330;

/** Hub / workbench middle column max width (DualPaneLayout, PropertyScreenLayout, etc.) */
export const WORK_SURFACE_MAX_PX = 700;

/** Property workspace action / AI rail max width beside the work surface */
export const WORKSPACE_ACTION_RAIL_MAX_PX = 280;

/** Content width inside work surface after `px-1` (4px × 2) gutters */
export const WORK_SURFACE_CONTENT_MAX_PX = WORK_SURFACE_MAX_PX - 8;
