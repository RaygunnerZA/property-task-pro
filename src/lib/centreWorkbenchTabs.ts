/** Primary tabs in the centre work column (Home workbench). */
export type CentreWorkbenchTab = "inflow" | "tasks" | "calendar";

export const CENTRE_WORKBENCH_TAB_QUERY = "panelTab";

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
