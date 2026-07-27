import type { DashboardWorkbenchPanel } from "@/lib/propertyRoutes";

/**
 * Desktop vs mobile workbench presentation (same platform, different surfaces).
 *
 * @see Docs/04_UI_System.md §4.2 — Desktop operational workbench vs Mobile work-execution-first
 * @see LAYOUT_BREAKPOINTS.phone in layoutBreakpoints.ts (768px / Tailwind `md`)
 *
 * | Surface        | Route example | Desktop                         | Phone (< phone bp)                             |
 * |----------------|---------------|---------------------------------|------------------------------------------------|
 * | `home-hub`     | `/`           | Left scope + centre work column | Scope / property grounding only                |
 * | `work-surface` | `/tasks`      | Same dual/triple columns        | Full-screen centre (Inflow · Tasks · Calendar) |
 *
 * Phone does not stack desktop columns. Bottom nav + routes carry UX weight.
 * Property is scope (filters the current surface), not a parallel nav tree.
 */
export type WorkbenchSurfaceRole = "home-hub" | "work-surface";

export type PropertyCentreNavContract = {
  /**
   * Legacy: phone property cards used a separate centre-nav row.
   * Inflow · Tasks · Calendar now live in the mobile stat columns.
   */
  showBelowPhone: boolean;
  /** Deep-link to `/tasks` instead of mutating `panelTab` in place. */
  routeToWorkSurface: boolean;
};

export type WorkbenchLayoutContract = {
  surfaceRole: WorkbenchSurfaceRole;
  /** DualPane: hide centre column and defer dual-column grid until phone+. */
  collapseCentreOnPhone: boolean;
  /** Centre tab strip is irrelevant when the centre is collapsed on phone. */
  hideCentreTabStripOnPhone: boolean;
  propertyCentreNav: PropertyCentreNavContract;
};

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
  const homeHub = isHomeHubPath(pathname) && workbenchPanel === "home";

  if (homeHub) {
    return {
      surfaceRole: "home-hub",
      collapseCentreOnPhone: true,
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
    /** Phone stats embed Inflow · Tasks · Calendar; strip is desktop-only. */
    hideCentreTabStripOnPhone: true,
    propertyCentreNav: {
      showBelowPhone: false,
      routeToWorkSurface: false,
    },
  };
}

/** True when centre-tab clicks on phone home should navigate to the work route. */
export function shouldRouteCentreTabsToWorkSurface(
  layout: WorkbenchLayoutContract,
  isPhoneViewport: boolean
): boolean {
  return layout.surfaceRole === "home-hub" && isPhoneViewport;
}
