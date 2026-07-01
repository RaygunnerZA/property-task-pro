/** Primary tabs in the centre work column (Home workbench). */
export type CentreWorkbenchTab = "inflow" | "tasks" | "calendar";

export const CENTRE_WORKBENCH_TAB_QUERY = "panelTab";

/** Selected day for calendar / schedule (`yyyy-MM-dd`). */
export const WORKBENCH_DATE_QUERY = "date";

/** Centre calendar sub-view: `calendar` (month grid) or `schedule` (agenda). */
export const WORKBENCH_CALENDAR_VIEW_QUERY = "calendarView";

export type CentreCalendarView = "calendar" | "schedule";

export const CENTRE_WORKBENCH_TASKS_PATH = "/tasks";

export const CENTRE_WORKBENCH_TABS: readonly CentreWorkbenchTab[] = [
  "inflow",
  "tasks",
  "calendar",
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
  inflow: {
    id: "inflow",
    label: "Inflow",
    accentColor: "#EB6834",
    fill: "hsl(16 78% 84%)",
    description: "Signals, suggestions, and records waiting for a decision.",
    illustrationSrc: "/issues-workbench/needs-review.png",
  },
  tasks: {
    id: "tasks",
    label: "Tasks",
    accentColor: "#85BABC",
    fill: "hsl(185 38% 82%)",
    description: "Your work queue — urgent items, assignments, and due dates.",
    illustrationSrc: "/issues-workbench/open-work.png",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    accentColor: "#7B8794",
    fill: "hsl(215 12% 84%)",
    description: "Month grid and day-by-day schedule for planned work.",
    illustrationSrc: "/issues-workbench/recent-signals.png",
  },
};

const LEGACY_CENTRE_TAB_MAP: Record<string, CentreWorkbenchTab> = {
  inflow: "inflow",
  attention: "inflow",
  issues: "inflow",
  tasks: "tasks",
  calendar: "calendar",
  schedule: "calendar",
  agenda: "calendar",
  records: "inflow",
};

export function normalizeCentreWorkbenchTab(
  panelTabRaw: string | null | undefined,
  tabAliasRaw?: string | null | undefined
): CentreWorkbenchTab {
  const raw = (panelTabRaw || tabAliasRaw || "").toLowerCase();
  if (LEGACY_CENTRE_TAB_MAP[raw]) return LEGACY_CENTRE_TAB_MAP[raw];
  return "inflow";
}

export function isCentreWorkbenchTab(value: string): value is CentreWorkbenchTab {
  return CENTRE_WORKBENCH_TABS.includes(value as CentreWorkbenchTab);
}

export function normalizeCentreCalendarView(
  raw: string | null | undefined
): CentreCalendarView {
  return raw === "schedule" ? "schedule" : "calendar";
}

/** Deep link from property cards → `/tasks` work column. */
export function centreWorkbenchTasksPath(
  tab: CentreWorkbenchTab,
  searchParams?: URLSearchParams | string
): string {
  const params = new URLSearchParams(searchParams);
  params.delete("tab");
  if (tab === "tasks") {
    params.delete(CENTRE_WORKBENCH_TAB_QUERY);
  } else {
    params.set(CENTRE_WORKBENCH_TAB_QUERY, tab);
  }
  const qs = params.toString();
  return qs ? `${CENTRE_WORKBENCH_TASKS_PATH}?${qs}` : CENTRE_WORKBENCH_TASKS_PATH;
}
