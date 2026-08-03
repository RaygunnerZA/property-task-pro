import type { DashboardWorkbenchPanel } from "@/lib/propertyRoutes";

/**
 * Desktop vs mobile workbench presentation (same platform, different surfaces).
 *
 * @see Docs/04_UI_System.md §4.2 — Desktop operational workbench vs Mobile work-execution-first
 * @see LAYOUT_BREAKPOINTS.phone in layoutBreakpoints.ts (768px / Tailwind `md`)
 *
 * | Surface        | Route example           | Desktop                         | Phone (< phone bp)                                              |
 * |----------------|-------------------------|---------------------------------|-----------------------------------------------------------------|
 * | `home-hub`     | `/`, `/home?property=`  | Left scope + centre work column | Left only (property / portfolio chrome through Spaces…Records)   |
 * | `work-surface` | `/tasks`                | Same dual/triple columns        | Centre only — Inflow \| Tasks \| Calendar tab strip + content   |
 *
 * On phone, PropertySummaryPanel Inflow · Tasks · Calendar cells deep-link to `/tasks`
 * (work-surface). Property is scope (filters the current surface), not a parallel nav tree.
 */
export type WorkbenchSurfaceRole = "home-hub" | "work-surface";

export type PropertyCentreNavContract = {
  /**
   * Phone: property summary stats double as Inflow · Tasks · Calendar entry
   * (to review → Inflow, open tasks → Tasks, upcoming events → Calendar)
   */
  showBelowPhone: boolean;
  /** Deep-link to `/tasks` instead of mutating `panelTab` in place. */
  routeToWorkSurface: boolean;
};

export type WorkbenchLayoutContract = {
  surfaceRole: WorkbenchSurfaceRole;
  /** DualPane: hide centre column below the phone breakpoint. */
  collapseCentreOnPhone: boolean;
  /**
   * DualPane: hide left (property) rail below the phone breakpoint.
   * Work-surface phone (`/tasks`) = centre work only.
   */
  collapseLeftOnPhone: boolean;
  /**
   * DualPane: stack left above centre below `md` (neither column hidden).
   * Unused for current home/work contracts; kept for DualPane flexibility.
   */
  stackOnPhone: boolean;
  /**
   * Hide the centre Inflow · Tasks · Calendar tab strip below the phone breakpoint.
   * Home hides the strip (and the whole centre); work-surface keeps it visible.
   */
  hideCentreTabStripOnPhone: boolean;
  propertyCentreNav: PropertyCentreNavContract;
};

/** Portfolio carousel home (`/`) — not property home (`/home`). */
export function isHomeHubPath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

/**
 * Resolve the layout contract from route + workbench panel.
 * Keep DualPane / property-card / navigation flags in sync via this helper only.
 */
export function resolveWorkbenchLayout(args: {
  pathname: string;
  workbenchPanel: DashboardWorkbenchPanel;
}): WorkbenchLayoutContract {
  const { pathname, workbenchPanel } = args;
  /** Portfolio (`/`) and property home (`/home`) share the phone scope-only contract. */
  const homeHub =
    pathname === "/home" ||
    workbenchPanel === "issues" ||
    (isHomeHubPath(pathname) && workbenchPanel === "home");

  if (homeHub) {
    return {
      surfaceRole: "home-hub",
      /** Phone: scope chrome only — Quick Wins / centre work live on `/tasks`. */
      collapseCentreOnPhone: true,
      collapseLeftOnPhone: false,
      stackOnPhone: false,
      hideCentreTabStripOnPhone: true,
      propertyCentreNav: {
        showBelowPhone: true,
        routeToWorkSurface: true,
      },
    };
  }

  return {
    surfaceRole: "work-surface",
    collapseCentreOnPhone: false,
    /** Phone: property rail hidden — Inflow / Tasks / Calendar fill below the header. */
    collapseLeftOnPhone: true,
    stackOnPhone: false,
    /** Full-screen Inflow · Tasks · Calendar — tab strip always below header. */
    hideCentreTabStripOnPhone: false,
    propertyCentreNav: {
      showBelowPhone: false,
      routeToWorkSurface: false,
    },
  };
}

/** True when centre-tab / summary clicks on phone home should navigate to `/tasks`. */
export function shouldRouteCentreTabsToWorkSurface(
  layout: WorkbenchLayoutContract,
  isPhoneViewport: boolean
): boolean {
  return layout.propertyCentreNav.routeToWorkSurface && isPhoneViewport;
}
