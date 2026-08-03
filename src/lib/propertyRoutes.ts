/** Query key for TaskPanel tab on the property workbench (`/?property=&panelTab=`). */
export const WORKBENCH_PANEL_TAB_QUERY = "panelTab";

/** Optional alias for `panelTab` (e.g. deep links using `?tab=records`). */
export const WORKBENCH_TAB_ALIAS_QUERY = "tab";

/** Records sub-view inside the workbench (`/?property=&panelTab=records&recordsView=`). */
export const WORKBENCH_RECORDS_VIEW_QUERY = "recordsView";

/** Issues sub-filter inside the workbench (`/?property=&issuesFilter=`). */
export const WORKBENCH_ISSUES_FILTER_QUERY = "issuesFilter";

/** When `issuesFilter=open`, narrows the task list to urgent/high priority (`/?taskPriority=urgent`). */
export const WORKBENCH_TASK_PRIORITY_QUERY = "taskPriority";

/** Narrow the Tasks workbench to a single space (`/?property=&space=`). */
export const WORKBENCH_SPACE_QUERY = "space";

export type WorkbenchPanelTab = "issues" | "records" | "schedule";

/** Portfolio hub (`/`) vs property home (`/home`) vs dedicated workbench pages (`/records`, `/agenda`). */
export type DashboardWorkbenchPanel = "home" | WorkbenchPanelTab;

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

export type WorkbenchIssuesFilter = "all" | "urgent" | "open" | "done";

const LEGACY_PANEL_TAB_MAP: Record<string, WorkbenchPanelTab> = {
  attention: "issues",
  issues: "issues",
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

const VALID_ISSUES_FILTERS = new Set<string>(["all", "urgent", "open", "done"]);

export function normalizeWorkbenchIssuesFilter(raw: string | null | undefined): WorkbenchIssuesFilter {
  if (!raw) return "all";
  const f = raw.toLowerCase();
  if (f === "review" || f === "recent") return "all";
  if (VALID_ISSUES_FILTERS.has(f)) return f as WorkbenchIssuesFilter;
  return "all";
}

/** TaskList filter IDs applied when Issues slice is "Open" (active work, not completed). */
export const ISSUES_OPEN_TASK_FILTER_IDS = [
  "filter-status-todo",
  "filter-status-in-progress",
  "filter-status-waiting-review",
  "filter-status-blocked",
] as const;

function workbenchScopedPath(
  basePath: string,
  propertyId: string,
  extra?: Record<string, string>
): string {
  const q = new URLSearchParams();
  q.set("property", propertyId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  return `${basePath}?${q.toString()}`;
}

/** Records workbench with an optional sub-view. */
export function propertyHubRecordsPath(propertyId: string, recordsView?: RecordsView): string {
  const extra: Record<string, string> = {};
  if (recordsView && recordsView !== "all") {
    extra[WORKBENCH_RECORDS_VIEW_QUERY] = recordsView;
  }
  return workbenchScopedPath("/records", propertyId, extra);
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

/** Canonical URL for property home (`/home`) with optional query params. */
export function propertyHubPath(propertyId: string, extra?: Record<string, string>): string {
  return workbenchScopedPath("/home", propertyId, extra);
}

/** Property-scoped spaces organise screen. */
export function propertyHubSpacesPath(propertyId: string): string {
  return propertySubPath(propertyId, "spaces-organise");
}

/**
 * Property compliance setup (rules). Portfolio / certificates stay on Records
 * via `propertyHubRecordsPath(id, "compliance")` / `propertySubPath(id, "compliance")`.
 */
export function propertyComplianceSetupPath(
  propertyId: string,
  options?: { addRule?: boolean }
): string {
  const base = `/properties/${propertyId}/compliance`;
  if (options?.addRule) {
    return `${base}?addRule=1`;
  }
  return base;
}

/** Property-scoped assets list. */
export function propertyHubAssetsPath(propertyId: string): string {
  return `/assets?property=${encodeURIComponent(propertyId)}`;
}

/** Org team settings — owners, contacts, and members (no per-property route yet). */
export function propertyHubPeoplePath(_propertyId: string): string {
  return "/settings/team";
}

/**
 * Property home (`/home`) with an optional Inflow sub-filter (e.g. open tasks).
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
  return workbenchScopedPath("/home", propertyId, extra);
}

/** Day agenda workbench (`/agenda`). */
export function propertyHubAgendaPath(propertyId: string): string {
  return workbenchScopedPath("/agenda", propertyId);
}

/** @deprecated Prefer `propertyHubIssuesPath(id, { issuesFilter: "open" })`. */
export function propertyHubTasksPath(propertyId: string): string {
  return propertyHubIssuesPath(propertyId, { issuesFilter: "open" });
}

/**
 * Tasks work-surface scoped to a property + space
 * (`/tasks?property=&panelTab=tasks&space=`).
 */
export function propertySpaceTasksPath(propertyId: string, spaceId: string): string {
  const q = new URLSearchParams();
  q.set("property", propertyId);
  q.set(WORKBENCH_PANEL_TAB_QUERY, "tasks");
  q.set(WORKBENCH_SPACE_QUERY, spaceId);
  return `/tasks?${q.toString()}`;
}
