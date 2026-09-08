import type {
  ReportDesignFilters,
  ReportSectionId,
  ReportTaskStatusFilter,
  ReportTemplateId,
} from "./types";
import { getReportTemplate } from "./templates";

/** Default operational statuses when starting a new workspace design. */
export const DEFAULT_REPORT_TASK_STATUSES: ReportTaskStatusFilter[] = [
  "open",
  "in_progress",
  "waiting_review",
];

export const ALL_REPORT_TASK_STATUSES: ReportTaskStatusFilter[] = [
  "open",
  "in_progress",
  "waiting_review",
  "completed",
  "archived",
];

export const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  ai_summary: "AI summary",
  trend: "Trend",
  attention: "Needs attention",
  tasks: "Tasks",
  compliance: "Compliance",
  spaces: "Spaces",
  evidence: "Evidence",
  notes: "Notes",
};

export function emptyReportDesignFilters(
  templateId?: ReportTemplateId
): ReportDesignFilters {
  const sectionIds = templateId
    ? [...getReportTemplate(templateId).sections]
    : null;
  return {
    spaceIds: [],
    taskStatuses: [...DEFAULT_REPORT_TASK_STATUSES],
    sectionIds,
  };
}

export function normalizeReportDesignFilters(
  raw: Partial<ReportDesignFilters> | null | undefined,
  templateId?: ReportTemplateId
): ReportDesignFilters {
  const fallback = emptyReportDesignFilters(templateId);
  if (!raw || typeof raw !== "object") return fallback;
  const allowed = new Set<string>(ALL_REPORT_TASK_STATUSES);
  return {
    spaceIds: Array.isArray(raw.spaceIds)
      ? raw.spaceIds.filter((id): id is string => typeof id === "string")
      : fallback.spaceIds,
    taskStatuses: Array.isArray(raw.taskStatuses)
      ? (raw.taskStatuses.filter((s): s is ReportTaskStatusFilter =>
          allowed.has(s)
        ) as ReportTaskStatusFilter[])
      : fallback.taskStatuses,
    sectionIds: Array.isArray(raw.sectionIds)
      ? (raw.sectionIds as ReportSectionId[])
      : raw.sectionIds === null
        ? null
        : fallback.sectionIds,
  };
}
