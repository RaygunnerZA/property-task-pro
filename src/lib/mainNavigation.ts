import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Building2,
  BookOpen,
  BarChart3,
  FolderOpen,
} from "lucide-react";

export type MainNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

/** Primary app navigation (sidebar + mobile). */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "My Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

/** Former workbench tabs — now standalone routes. */
export const WORKBENCH_SECTION_ROUTES = {
  /** Property Attention hub (replaces legacy Issues triage). */
  attention: "/issues",
  issues: "/issues",
  records: "/records",
  schedule: "/agenda",
} as const;

export function isMainNavActive(pathname: string, url: string): boolean {
  if (url === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** Primary mobile bottom navigation (below lg). */
export const MOBILE_NAV_ITEMS: MainNavItem[] = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Schedule", url: "/agenda", icon: Calendar },
  { title: "Records", url: "/records", icon: FolderOpen },
];

export function isMobileNavActive(pathname: string, url: string): boolean {
  if (url === "/") {
    return (
      pathname === "/" ||
      pathname === "/dashboard" ||
      pathname === "/issues" ||
      pathname === "/attention"
    );
  }
  if (url === "/agenda") {
    return pathname === "/agenda" || pathname === "/calendar" || pathname.startsWith("/agenda/");
  }
  if (url === "/records") {
    return pathname === "/records" || pathname.startsWith("/records/");
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** Routes that render their own mobile header (workbench gradient / calendar). */
export const MOBILE_HEADER_EXCLUDED_PATHS = new Set([
  "/",
  "",
  "/issues",
  "/attention",
  "/records",
  "/agenda",
  "/calendar",
]);

/** @deprecated Use MOBILE_HEADER_EXCLUDED_PATHS */
export const HUB_PATHS = MOBILE_HEADER_EXCLUDED_PATHS;

export function isMobileHeaderExcludedPath(pathname: string): boolean {
  return MOBILE_HEADER_EXCLUDED_PATHS.has(pathname);
}
