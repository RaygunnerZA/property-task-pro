import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Building2,
  BookOpen,
  BarChart3,
  Shield,
  MoreHorizontal,
  Layers,
  Box,
  FolderOpen,
  Tags,
} from "lucide-react";
import { centreWorkbenchTasksPath } from "@/lib/centreWorkbenchTabs";

export type MainNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

/** Centre workbench Calendar tab (Inflow · Tasks · Calendar). */
export const MAIN_NAV_CALENDAR_HREF = centreWorkbenchTasksPath("calendar");

/**
 * Primary app navigation (desktop sidebar).
 * Work → place → evidence → classify → portfolio → insight.
 */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: MAIN_NAV_CALENDAR_HREF, icon: Calendar },
  { title: "Spaces", url: "/spaces", icon: Layers },
  { title: "Assets", url: "/assets", icon: Box },
  { title: "Records", url: "/records", icon: FolderOpen },
  { title: "Tags", url: "/tags", icon: Tags },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

/** Former workbench tabs — now standalone routes. */
export const WORKBENCH_SECTION_ROUTES = {
  /** Property home (Inflow · Tasks · Calendar with property scope). */
  attention: "/home",
  issues: "/home",
  records: "/records",
  schedule: "/agenda",
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
  const targetPanel = panelTabFromSearch(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
  const currentPanel = panelTabFromSearch(search);

  // Calendar → centre Tab-Calendar (`/tasks?panelTab=calendar`), plus legacy routes.
  if (targetPanel === "calendar" || targetPath === "/calendar") {
    if (pathname === "/calendar" || pathname === "/agenda") return true;
    if (pathname === "/tasks" || pathname === "/home") {
      return currentPanel === "calendar";
    }
    return false;
  }

  if (targetPath === "/") {
    return (
      pathname === "/" ||
      pathname === "/home" ||
      pathname === "/dashboard"
    );
  }
  if (targetPath === "/tasks") {
    if (pathname !== "/tasks") return false;
    // Tasks nav stays inactive while the Calendar centre tab is selected.
    return currentPanel !== "calendar";
  }
  if (targetPath === "/spaces") {
    return (
      pathname === "/spaces" ||
      pathname === "/manage/spaces" ||
      /\/properties\/[^/]+\/spaces(?:\/|$)/.test(pathname)
    );
  }
  if (targetPath === "/assets") {
    return pathname === "/assets" || pathname.startsWith("/assets/");
  }
  if (targetPath === "/records") {
    return pathname === "/records" || pathname.startsWith("/records/");
  }
  if (targetPath === "/tags") {
    return pathname === "/tags" || pathname.startsWith("/tags/");
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
    return (
      pathname === "/tasks" ||
      pathname.startsWith("/tasks/") ||
      pathname === "/agenda" ||
      pathname === "/calendar" ||
      pathname.startsWith("/agenda/")
    );
  }
  if (url === "/compliance") {
    return pathname === "/compliance" || pathname.startsWith("/compliance/");
  }
  if (url === "/records") {
    return pathname === "/records" || pathname.startsWith("/records/");
  }
  if (url === "/spaces") {
    return isMainNavActive(pathname, "/spaces");
  }
  if (url === "/assets") {
    return pathname === "/assets" || pathname.startsWith("/assets/");
  }
  if (url === "/tags") {
    return pathname === "/tags" || pathname.startsWith("/tags/");
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

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
]);

/** @deprecated Use MOBILE_HEADER_EXCLUDED_PATHS */
export const HUB_PATHS = MOBILE_HEADER_EXCLUDED_PATHS;

export function isMobileHeaderExcludedPath(pathname: string): boolean {
  return MOBILE_HEADER_EXCLUDED_PATHS.has(pathname);
}

/**
 * Desktop workbench gradient header sits above the icon rail (full-bleed).
 * Matches pages that render {@link WorkbenchGradientHeader}.
 */
export function isWorkbenchHeaderAboveNavPath(pathname: string): boolean {
  return isMobileHeaderExcludedPath(pathname);
}
