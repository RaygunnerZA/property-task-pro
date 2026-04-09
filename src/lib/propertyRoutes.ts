/** Query key for TaskPanel tab on the property workbench (`/?property=&panelTab=`). */
export const WORKBENCH_PANEL_TAB_QUERY = "panelTab";

/** Issues sub-filter inside the workbench (`/?property=&issuesFilter=`). */
export const WORKBENCH_ISSUES_FILTER_QUERY = "issuesFilter";

export type WorkbenchPanelTab = "issues" | "records" | "schedule";

export type WorkbenchIssuesFilter = "all" | "urgent" | "review" | "open" | "done" | "recent";

const LEGACY_PANEL_TAB_MAP: Record<string, WorkbenchPanelTab> = {
  attention: "issues",
  tasks: "issues",
  compliance: "records",
};

/** Normalize URL tab values (legacy `attention` / `tasks` / `compliance` → canonical). */
export function normalizeWorkbenchPanelTab(raw: string | null | undefined): WorkbenchPanelTab {
  if (!raw) return "issues";
  const t = raw.toLowerCase();
  if (LEGACY_PANEL_TAB_MAP[t]) return LEGACY_PANEL_TAB_MAP[t];
  if (t === "issues" || t === "records" || t === "schedule") return t;
  return "issues";
}

const VALID_ISSUES_FILTERS = new Set<string>(["all", "urgent", "review", "open", "done", "recent"]);

export function normalizeWorkbenchIssuesFilter(raw: string | null | undefined): WorkbenchIssuesFilter {
  if (!raw) return "all";
  const f = raw.toLowerCase();
  if (VALID_ISSUES_FILTERS.has(f)) return f as WorkbenchIssuesFilter;
  return "all";
}

/** TaskList filter IDs applied when Issues slice is "Open" (active work, not completed). */
export const ISSUES_OPEN_TASK_FILTER_IDS = [
  "filter-status-todo",
  "filter-status-in-progress",
  "filter-status-blocked",
] as const;

/** Canonical URL for the property workbench (dashboard at / with property scope). */
export function propertyHubPath(propertyId: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  q.set("property", propertyId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  return `/?${q.toString()}`;
}

/**
 * Property hub with Issues selected and an optional sub-filter (e.g. open tasks).
 * Default workbench tab is Issues when `panelTab` is omitted.
 */
export function propertyHubIssuesPath(
  propertyId: string,
  options?: { issuesFilter?: WorkbenchIssuesFilter }
): string {
  const extra: Record<string, string> = {};
  const f = options?.issuesFilter;
  if (f && f !== "all") {
    extra[WORKBENCH_ISSUES_FILTER_QUERY] = f;
  }
  return propertyHubPath(propertyId, extra);
}

/** @deprecated Prefer `propertyHubIssuesPath(id, { issuesFilter: "open" })`. */
export function propertyHubTasksPath(propertyId: string): string {
  return propertyHubIssuesPath(propertyId, { issuesFilter: "open" });
}

export type PropertySubRoute =
  | "documents"
  | "compliance"
  | "photos"
  | "plans"
  | "spaces-organise";

export function propertySubPath(propertyId: string, segment: PropertySubRoute): string {
  switch (segment) {
    case "documents":
      return `/properties/${propertyId}/documents`;
    case "compliance":
      return `/properties/${propertyId}/compliance`;
    case "photos":
      return `/properties/${propertyId}/photos`;
    case "plans":
      return `/properties/${propertyId}/plans`;
    case "spaces-organise":
      return `/properties/${propertyId}/spaces/organise`;
  }
}
