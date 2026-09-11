/** Primary workspace centre tabs (Tasks · Calendar · Records). Home/Inflow is standalone. */
export type CentreWorkbenchTab = "tasks" | "calendar" | "records";

export const CENTRE_WORKBENCH_TAB_QUERY = "panelTab";

/** Selected day for calendar / schedule (`yyyy-MM-dd`). */
export const WORKBENCH_DATE_QUERY = "date";

/** Centre calendar sub-view: `calendar` (month grid) or `schedule` (agenda). */
export const WORKBENCH_CALENDAR_VIEW_QUERY = "calendarView";

export type CentreCalendarView = "calendar" | "schedule";

/** Dedicated work-surface routes. */
export const CENTRE_WORKBENCH_TASKS_PATH = "/tasks";
export const CENTRE_WORKBENCH_CALENDAR_PATH = "/calendar";
export const CENTRE_WORKBENCH_RECORDS_PATH = "/records";

export const CENTRE_WORKBENCH_TABS: readonly CentreWorkbenchTab[] = [
  "tasks",
  "calendar",
  "records",
] as const;

export type CentreWorkbenchTabMeta = {
  id: CentreWorkbenchTab;
  label: string;
  /** Accent when this tab is active */
  accentColor: string;
  /** Paper-textured tab / panel fill */
  fill: string;
  description: string;
  illustrationSrc: string;
};

export const CENTRE_WORKBENCH_TAB_META: Record<CentreWorkbenchTab, CentreWorkbenchTabMeta> = {
  tasks: {
    id: "tasks",
    label: "Tasks",
    accentColor: "#85BABC",
    fill: "hsl(185 38% 82%)",
    description: "Your work queue — urgent items, assignments, and due dates.",
    illustrationSrc: "/centre-workbench/tasks.png",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    accentColor: "#7B8794",
    fill: "hsl(215 12% 84%)",
    description: "Month grid and day-by-day schedule for planned work.",
    illustrationSrc: "/centre-workbench/calendar.png",
  },
  records: {
    id: "records",
    label: "Records",
    accentColor: "#C4A35A",
    fill: "hsl(42 45% 86%)",
    description: "Evidence, certificates, documents, and compliance artefacts.",
    illustrationSrc: "/centre-workbench/records.png",
  },
};

const LEGACY_CENTRE_TAB_MAP: Record<string, CentreWorkbenchTab> = {
  tasks: "tasks",
  calendar: "calendar",
  schedule: "calendar",
  agenda: "calendar",
  records: "records",
  // Legacy Inflow deep-links land on Tasks within the primary workspace;
  // Home/Inflow itself is `/` (no centre tab).
  inflow: "tasks",
  attention: "tasks",
  issues: "tasks",
};

export function normalizeCentreWorkbenchTab(
  panelTabRaw: string | null | undefined,
  tabAliasRaw?: string | null | undefined
): CentreWorkbenchTab {
  const raw = (panelTabRaw || tabAliasRaw || "").toLowerCase();
  if (LEGACY_CENTRE_TAB_MAP[raw]) return LEGACY_CENTRE_TAB_MAP[raw];
  return "tasks";
}

export function isCentreWorkbenchTab(value: string): value is CentreWorkbenchTab {
  return CENTRE_WORKBENCH_TABS.includes(value as CentreWorkbenchTab);
}

export function normalizeCentreCalendarView(
  raw: string | null | undefined
): CentreCalendarView {
  return raw === "schedule" ? "schedule" : "calendar";
}

export function centreWorkbenchPathForTab(tab: CentreWorkbenchTab): string {
  switch (tab) {
    case "calendar":
      return CENTRE_WORKBENCH_CALENDAR_PATH;
    case "records":
      return CENTRE_WORKBENCH_RECORDS_PATH;
    case "tasks":
    default:
      return CENTRE_WORKBENCH_TASKS_PATH;
  }
}

/**
 * Canonical primary-workspace URL for a tab (+ optional `?property=` etc.).
 * Prefer dedicated routes (`/tasks`, `/calendar`, `/records`) over `panelTab`.
 */
export function centreWorkbenchTasksPath(
  tab: CentreWorkbenchTab,
  searchParams?: URLSearchParams | string
): string {
  const params = new URLSearchParams(searchParams);
  params.delete("tab");
  params.delete(CENTRE_WORKBENCH_TAB_QUERY);
  const path = centreWorkbenchPathForTab(tab);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Infer active centre tab from pathname (+ legacy panelTab on /tasks|/home). */
export function centreWorkbenchTabFromLocation(
  pathname: string,
  search: string = ""
): CentreWorkbenchTab {
  if (pathname === "/calendar" || pathname === "/agenda" || pathname === "/schedule") {
    return "calendar";
  }
  if (pathname === "/records" || pathname.startsWith("/records/")) {
    return "records";
  }
  if (pathname === "/tasks") {
    const panel = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search
    ).get(CENTRE_WORKBENCH_TAB_QUERY);
    if (panel === "calendar") return "calendar";
    if (panel === "records") return "records";
    return "tasks";
  }
  return "tasks";
}
