import { getTaskDueUrgency } from "@/lib/taskDueUrgency";

const TERMINAL_STATUSES = new Set(["completed", "archived", "done"]);

function isOpenTask(task: { status?: string | null }): boolean {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

function isCompletedTask(task: { status?: string | null }): boolean {
  const status = (task.status ?? "").toLowerCase();
  return status === "completed" || status === "done";
}

/** Open work missing due date, assignee, or location context. */
export function isTaskMissingInfo(task: {
  status?: string | null;
  due_date?: string | null;
  assigned_user_id?: string | null;
  spaces?: unknown;
}): boolean {
  if (!isOpenTask(task)) return false;
  if (!task.due_date) return true;
  if (task.assigned_user_id) return false;
  const spaces = task.spaces;
  if (Array.isArray(spaces) && spaces.length > 0) return false;
  return true;
}

export type HubSummaryMetrics = {
  openTasksCount: number;
  urgentCount: number;
  spacesCount: number;
  assetsCount: number;
  completionPct: number;
  completedLabel: string;
  dueSoonCount: number;
  overdueCount: number;
  missingInfoCount: number;
};

type HubTask = {
  status?: string | null;
  priority?: string | null;
  property_id?: string | null;
  due_date?: string | null;
  assigned_user_id?: string | null;
  spaces?: unknown;
};

type HubProperty = {
  id: string;
  open_tasks_count?: number | null;
  spaces_count?: number | null;
  assets_count?: number | null;
};

export function computeHubSummaryMetrics(
  tasks: HubTask[],
  properties: HubProperty[],
  selectedPropertyIds: Set<string>
): HubSummaryMetrics {
  const allPropertyIds = properties.map((p) => p.id);
  const scopeAll =
    selectedPropertyIds.size === 0 || selectedPropertyIds.size >= allPropertyIds.length;
  const scopedPropertyIds = scopeAll
    ? new Set(allPropertyIds)
    : new Set([...selectedPropertyIds].filter((id) => allPropertyIds.includes(id)));

  const scopedProperties = properties.filter((p) => scopedPropertyIds.has(p.id));
  const scopedTasks = tasks.filter(
    (t) => t.property_id && scopedPropertyIds.has(t.property_id)
  );

  const activeTasks = scopedTasks.filter((t) => (t.status ?? "").toLowerCase() !== "archived");
  const openTasks = activeTasks.filter(isOpenTask);
  const doneCount = activeTasks.filter(isCompletedTask).length;
  const totalForCompletion = openTasks.length + doneCount;
  const completionPct =
    totalForCompletion > 0 ? Math.round((doneCount / totalForCompletion) * 100) : 0;

  const urgentCount = openTasks.filter((t) => {
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  }).length;

  let dueSoonCount = 0;
  let overdueCount = 0;
  let missingInfoCount = 0;
  for (const task of openTasks) {
    const urgency = getTaskDueUrgency(task);
    if (urgency === "due_soon") dueSoonCount++;
    if (urgency === "overdue") overdueCount++;
    if (isTaskMissingInfo(task)) missingInfoCount++;
  }

  const openFromProperties = scopedProperties.reduce(
    (sum, p) => sum + (p.open_tasks_count ?? 0),
    0
  );
  const openTasksCount = openFromProperties > 0 ? openFromProperties : openTasks.length;

  const spacesCount = scopedProperties.reduce((sum, p) => sum + (p.spaces_count ?? 0), 0);
  const assetsCount = scopedProperties.reduce((sum, p) => sum + (p.assets_count ?? 0), 0);

  return {
    openTasksCount,
    urgentCount,
    spacesCount,
    assetsCount,
    completionPct,
    completedLabel: `${doneCount} of ${totalForCompletion} complete`,
    dueSoonCount,
    overdueCount,
    missingInfoCount,
  };
}
