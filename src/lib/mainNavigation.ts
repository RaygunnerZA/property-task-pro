import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Building2,
  BookOpen,
  BarChart3,
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
