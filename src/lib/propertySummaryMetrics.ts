import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import { isTaskMissingInfo } from "@/lib/hubSummaryMetrics";
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
  dueSoonTasks: number;
  incompleteTasks: number;
  complianceReviews: number;
  complianceDueSoon: number;
  upcomingInspections: number;
  dueSoonInspections: number;
  overdueInspections: number;
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

function countComplianceDueSoon(documents: PropertyDocument[]): number {
  const today = new Date().toISOString().split("T")[0];
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().split("T")[0];

  return documents.filter(
    (d) => d.expiry_date && d.expiry_date >= today && d.expiry_date <= in30Str
  ).length;
}

function countInspectionUrgency(tasks: TaskLike[], documents: PropertyDocument[]) {
  const today = new Date().toISOString().split("T")[0];

  let dueSoonInspections = 0;
  let overdueInspections = 0;

  for (const task of tasks) {
    if (!isOpenTask(task) || !isInspectionLike(task.title)) continue;
    const urgency = getTaskDueUrgency(task);
    if (urgency === "due_soon") dueSoonInspections++;
    if (urgency === "overdue") overdueInspections++;
  }

  for (const doc of documents) {
    if (!isInspectionLike(doc.title) && !isInspectionLike(doc.document_type) && !isInspectionLike(doc.category)) {
      continue;
    }
    if (!doc.expiry_date) continue;
    if (doc.expiry_date < today) {
      overdueInspections++;
    } else {
      const in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      if (doc.expiry_date <= in7.toISOString().split("T")[0]) {
        dueSoonInspections++;
      }
    }
  }

  return { dueSoonInspections, overdueInspections };
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

  let dueSoonTasks = 0;
  let incompleteTasks = 0;
  for (const task of tasks) {
    if (!isOpenTask(task)) continue;
    if (getTaskDueUrgency(task) === "due_soon") dueSoonTasks++;
    if (isTaskMissingInfo(task)) incompleteTasks++;
  }

  const { dueSoonInspections, overdueInspections } = countInspectionUrgency(tasks, documents);

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
    dueSoonTasks,
    incompleteTasks,
    complianceReviews: countComplianceReviews(property, documents),
    complianceDueSoon: countComplianceDueSoon(documents),
    upcomingInspections: countUpcomingInspections(tasks, documents),
    dueSoonInspections,
    overdueInspections,
    spacesCount: property.spaces_count ?? 0,
    assetsCount: property.assets_count ?? 0,
    documentsCount: documents.length,
    messagesCount,
    completionPct,
    completedLabel: `${doneCount} of ${totalForCompletion} complete`,
  };
}

/** Portfolio-wide metrics for the home carousel "All properties" card. */
export function computeAllPropertiesSummaryMetrics(
  properties: PropertyLike[],
  tasks: TaskLike[],
  urgentOpenTaskCount: number
): PropertySummaryMetrics {
  const propertyIds = new Set(properties.map((p) => p.id));
  const scopedTasks = tasks.filter(
    (t) => t.property_id && propertyIds.has(t.property_id)
  );

  const openFromProperties = properties.reduce(
    (sum, p) => sum + (p.open_tasks_count ?? 0),
    0
  );
  const openTasksFromList = scopedTasks.filter(isOpenTask).length;
  const openTasks = openFromProperties > 0 ? openFromProperties : openTasksFromList;

  const urgentFromTasks = scopedTasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  }).length;
  const urgentItems = Math.max(urgentOpenTaskCount, urgentFromTasks);

  let dueSoonTasks = 0;
  let incompleteTasks = 0;
  for (const task of scopedTasks) {
    if (!isOpenTask(task)) continue;
    if (getTaskDueUrgency(task) === "due_soon") dueSoonTasks++;
    if (isTaskMissingInfo(task)) incompleteTasks++;
  }

  const { dueSoonInspections, overdueInspections } = countInspectionUrgency(scopedTasks, []);

  const doneCount = scopedTasks.filter((t) => {
    const status = (t.status ?? "").toLowerCase();
    return status === "completed" || status === "done";
  }).length;
  const totalForCompletion = openTasks + doneCount;
  const completionPct =
    totalForCompletion > 0 ? Math.round((doneCount / totalForCompletion) * 100) : 0;

  const complianceReviews = properties.reduce(
    (sum, p) =>
      sum + (p.expired_compliance_count ?? 0) + (p.valid_compliance_count ?? 0),
    0
  );

  const complianceDueSoon = properties.reduce((sum, p) => {
    const valid = p.valid_compliance_count ?? 0;
    return sum + valid;
  }, 0);

  return {
    urgentItems,
    openTasks,
    dueSoonTasks,
    incompleteTasks,
    complianceReviews,
    complianceDueSoon: Math.min(complianceDueSoon, complianceReviews),
    upcomingInspections: countUpcomingInspections(scopedTasks, []),
    dueSoonInspections,
    overdueInspections,
    spacesCount: properties.reduce((sum, p) => sum + (p.spaces_count ?? 0), 0),
    assetsCount: properties.reduce((sum, p) => sum + (p.assets_count ?? 0), 0),
    documentsCount: 0,
    messagesCount: 0,
    completionPct,
    completedLabel: `${doneCount} of ${totalForCompletion} complete`,
  };
}
