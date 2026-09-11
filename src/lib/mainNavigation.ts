import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Building2,
  BarChart3,
  Shield,
  MoreHorizontal,
  FolderOpen,
} from "lucide-react";

export type MainNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Optional raster icon override. */
  iconSrc?: string;
  /** When set, render a hover flyout of properties (multi-property orgs). */
  expandPropertiesOnHover?: boolean;
};

export type MainNavEntry =
  | { type: "item"; item: MainNavItem }
  | { type: "separator" };

/** Primary workspace — Tasks · Calendar · Records */
export const PROPERTY_SPACES_PATH = "/property/spaces";
export const PROPERTY_ASSETS_PATH = "/property/assets";
export const PROPERTY_PEOPLE_PATH = "/property/people";

/**
 * Primary app navigation (desktop sidebar).
 * Home → work → place entities → insight. Separators match constitution §4.6.
 */
export const MAIN_NAV_ENTRIES: MainNavEntry[] = [
  { type: "item", item: { title: "Home", url: "/", icon: LayoutDashboard } },
  { type: "separator" },
  { type: "item", item: { title: "Tasks", url: "/tasks", icon: CheckSquare } },
  { type: "item", item: { title: "Calendar", url: "/calendar", icon: Calendar } },
  { type: "item", item: { title: "Records", url: "/records", icon: FolderOpen } },
  { type: "separator" },
  {
    type: "item",
    item: {
      title: "Property",
      url: PROPERTY_SPACES_PATH,
      icon: Building2,
      expandPropertiesOnHover: true,
    },
  },
  { type: "item", item: { title: "Reports", url: "/reports", icon: BarChart3 } },
];

/** Flat list of clickable nav items (no separators). */
export const MAIN_NAV_ITEMS: MainNavItem[] = MAIN_NAV_ENTRIES.filter(
  (entry): entry is { type: "item"; item: MainNavItem } => entry.type === "item"
).map((entry) => entry.item);

/** Former workbench tabs — now standalone routes. */
export const WORKBENCH_SECTION_ROUTES = {
  attention: "/",
  issues: "/",
  records: "/records",
  schedule: "/calendar",
} as const;

function panelTabFromSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("panelTab");
}

export function isMainNavActive(
  pathname: string,
  url: string,
  search: string = ""
): boolean {
  const targetPath = url.split("?")[0];
  const currentPanel = panelTabFromSearch(search);

  if (targetPath === "/") {
    return pathname === "/" || pathname === "/home" || pathname === "/dashboard";
  }

  if (targetPath === "/tasks") {
    if (pathname !== "/tasks") return false;
    // Legacy: calendar used to live under /tasks?panelTab=calendar
    return currentPanel !== "calendar" && currentPanel !== "records";
  }

  if (targetPath === "/calendar") {
    if (pathname === "/calendar" || pathname === "/agenda" || pathname === "/schedule") {
      return true;
    }
    if (pathname === "/tasks" || pathname === "/home") {
      return currentPanel === "calendar";
    }
    return false;
  }

  if (targetPath === "/records") {
    return pathname === "/records" || pathname.startsWith("/records/");
  }

  if (targetPath === PROPERTY_SPACES_PATH || targetPath.startsWith("/property")) {
    return (
      pathname === "/property" ||
      pathname.startsWith("/property/") ||
      pathname === "/spaces" ||
      pathname === "/assets" ||
      pathname.startsWith("/assets/") ||
      pathname === "/manage/spaces" ||
      /\/properties\/[^/]+\/spaces(?:\/|$)/.test(pathname)
    );
  }

  if (targetPath === "/reports") {
    return pathname === "/reports" || pathname.startsWith("/reports/");
  }

  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

/** Primary mobile bottom navigation (below lg). */
export const MOBILE_NAV_ITEMS: MainNavItem[] = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Compliance", url: "/compliance", icon: Shield },
  { title: "More", url: "__more__", icon: MoreHorizontal },
];

export const MOBILE_MORE_NAV_URL = "__more__" as const;

export function isMobileNavActive(pathname: string, url: string): boolean {
  if (url === MOBILE_MORE_NAV_URL) {
    return false;
  }
  if (url === "/") {
    return (
      pathname === "/" ||
      pathname === "/home" ||
      pathname === "/dashboard" ||
      pathname === "/issues" ||
      pathname === "/attention"
    );
  }
  if (url === "/tasks") {
    return pathname === "/tasks" || pathname.startsWith("/tasks/");
  }
  if (url === "/compliance") {
    return pathname === "/compliance" || pathname.startsWith("/compliance/");
  }
  return isMainNavActive(pathname, url);
}

/** Items shown in the mobile “More” drawer. */
export const MOBILE_MORE_NAV_ITEMS: MainNavItem[] = [
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Records", url: "/records", icon: FolderOpen },
  { title: "Property", url: PROPERTY_SPACES_PATH, icon: Building2 },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

/** Routes that render their own mobile header (workbench gradient / calendar). */
export const MOBILE_HEADER_EXCLUDED_PATHS = new Set([
  "/",
  "",
  "/home",
  "/issues",
  "/attention",
  "/records",
  "/agenda",
  "/calendar",
  "/tasks",
  "/property",
  PROPERTY_SPACES_PATH,
  PROPERTY_ASSETS_PATH,
  PROPERTY_PEOPLE_PATH,
]);

/** @deprecated Use MOBILE_HEADER_EXCLUDED_PATHS */
export const HUB_PATHS = MOBILE_HEADER_EXCLUDED_PATHS;

export function isMobileHeaderExcludedPath(pathname: string): boolean {
  if (MOBILE_HEADER_EXCLUDED_PATHS.has(pathname)) return true;
  return pathname.startsWith("/property/");
}

/**
 * Desktop workbench gradient header sits above the icon rail (full-bleed).
 * Matches pages that render {@link WorkbenchGradientHeader}.
 */
export function isWorkbenchHeaderAboveNavPath(pathname: string): boolean {
  return isMobileHeaderExcludedPath(pathname);
}

/** @deprecated Prefer /calendar */
export const MAIN_NAV_CALENDAR_HREF = "/calendar";
