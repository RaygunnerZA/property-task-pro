import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";

const TERMINAL_STATUSES = new Set(["completed", "archived", "done"]);

type TaskLike = {
  status?: string | null;
  priority?: string | null;
  title?: string | null;
  due_date?: string | null;
  due_at?: string | null;
};

type PropertyLike = {
  open_tasks_count?: number | null;
  spaces_count?: number | null;
  assets_count?: number | null;
  expired_compliance_count?: number | null;
  valid_compliance_count?: number | null;
};

export type PropertySummaryMetrics = {
  urgentItems: number;
  openTasks: number;
  complianceReviews: number;
  upcomingInspections: number;
  spacesCount: number;
  assetsCount: number;
  documentsCount: number;
  messagesCount: number;
  completionPct: number;
  completedLabel: string;
};

function isOpenTask(task: TaskLike): boolean {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

function isInspectionLike(title: string | null | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return t.includes("inspect") || t.includes("service") || t.includes("certificate");
}

function countUpcomingInspections(tasks: TaskLike[], documents: PropertyDocument[]): number {
  const today = new Date().toISOString().split("T")[0];
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().split("T")[0];

  const docCount = documents.filter(
    (d) =>
      d.expiry_date &&
      d.expiry_date >= today &&
      d.expiry_date <= in30Str &&
      (isInspectionLike(d.title) ||
        isInspectionLike(d.document_type) ||
        isInspectionLike(d.category))
  ).length;

  const taskCount = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    if (!isInspectionLike(t.title)) return false;
    const urgency = getTaskDueUrgency(t);
    return urgency === "due_soon" || urgency === "overdue";
  }).length;

  return docCount + taskCount;
}

function countComplianceReviews(
  property: PropertyLike,
  documents: PropertyDocument[]
): number {
  const today = new Date().toISOString().split("T")[0];
  const expiredDocs = documents.filter((d) => d.expiry_date && d.expiry_date < today).length;
  const fromProperty =
    (property.expired_compliance_count ?? 0) + (property.valid_compliance_count ?? 0);
  return Math.max(fromProperty, expiredDocs);
}

export function computePropertySummaryMetrics(
  property: PropertyLike,
  tasks: TaskLike[],
  documents: PropertyDocument[],
  messagesCount: number,
  urgentOpenTaskCount: number
): PropertySummaryMetrics {
  const openTasksFromView = property.open_tasks_count ?? 0;
  const openTasksFromList = tasks.filter(isOpenTask).length;
  const openTasks = openTasksFromView > 0 ? openTasksFromView : openTasksFromList;

  const urgentFromTasks = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  }).length;
  const urgentItems = Math.max(urgentOpenTaskCount, urgentFromTasks);

  const doneCount = tasks.filter((t) => {
    const status = (t.status ?? "").toLowerCase();
    return status === "completed" || status === "done";
  }).length;
  const totalForCompletion = openTasks + doneCount;
  const completionPct =
    totalForCompletion > 0 ? Math.round((doneCount / totalForCompletion) * 100) : 0;

  return {
    urgentItems,
    openTasks,
    complianceReviews: countComplianceReviews(property, documents),
    upcomingInspections: countUpcomingInspections(tasks, documents),
    spacesCount: property.spaces_count ?? 0,
    assetsCount: property.assets_count ?? 0,
    documentsCount: documents.length,
    messagesCount,
    completionPct,
    completedLabel: `${doneCount} of ${totalForCompletion} complete`,
  };
}
