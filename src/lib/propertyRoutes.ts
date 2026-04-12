/** Query key for TaskPanel tab on the property workbench (`/?property=&panelTab=`). */
export const WORKBENCH_PANEL_TAB_QUERY = "panelTab";

/** Optional alias for `panelTab` (e.g. deep links using `?tab=records`). */
export const WORKBENCH_TAB_ALIAS_QUERY = "tab";

/** Records sub-view inside the workbench (`/?property=&panelTab=records&recordsView=`). */
export const WORKBENCH_RECORDS_VIEW_QUERY = "recordsView";

/** Issues sub-filter inside the workbench (`/?property=&issuesFilter=`). */
export const WORKBENCH_ISSUES_FILTER_QUERY = "issuesFilter";

export type WorkbenchPanelTab = "issues" | "records" | "schedule";

/** Primary slices inside the Records workspace (URL-backed on the hub). */
export type RecordsView =
  | "all"
  | "expiring"
  | "overdue"
  | "missing"
  | "compliance"
  | "documents"
  | "asset-docs";

const VALID_RECORDS_VIEWS = new Set<string>([
  "all",
  "expiring",
  "overdue",
  "missing",
  "compliance",
  "documents",
  "asset-docs",
]);

export function normalizeRecordsView(raw: string | null | undefined): RecordsView {
  if (!raw) return "all";
  const v = raw.toLowerCase();
  if (VALID_RECORDS_VIEWS.has(v)) return v as RecordsView;
  return "all";
}

export type WorkbenchIssuesFilter = "all" | "urgent" | "review" | "open" | "done" | "recent";

const LEGACY_PANEL_TAB_MAP: Record<string, WorkbenchPanelTab> = {
  attention: "issues",
  tasks: "issues",
  compliance: "records",
};

/**
 * Normalize workbench tab from `panelTab` or optional alias `tab`.
 * Legacy: `attention` / `tasks` → issues; `compliance` → records.
 */
export function normalizeWorkbenchPanelTab(
  panelTabRaw: string | null | undefined,
  tabAliasRaw?: string | null | undefined
): WorkbenchPanelTab {
  const raw = panelTabRaw || tabAliasRaw;
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

/** Hub with Records open and an optional records sub-view. */
export function propertyHubRecordsPath(propertyId: string, recordsView?: RecordsView): string {
  const extra: Record<string, string> = {
    [WORKBENCH_PANEL_TAB_QUERY]: "records",
  };
  if (recordsView && recordsView !== "all") {
    extra[WORKBENCH_RECORDS_VIEW_QUERY] = recordsView;
  }
  return propertyHubPath(propertyId, extra);
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
      return propertyHubRecordsPath(propertyId, "documents");
    case "compliance":
      return propertyHubRecordsPath(propertyId, "compliance");
    case "photos":
      return `/properties/${propertyId}/photos`;
    case "plans":
      return `/properties/${propertyId}/plans`;
    case "spaces-organise":
      return `/properties/${propertyId}/spaces/organise`;
  }
}
