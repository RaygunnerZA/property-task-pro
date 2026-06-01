import {
  endOfDay,
  endOfWeek,
  isValid,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type MyWorkTimeGroup = "overdue" | "today" | "thisWeek" | "completed";

export type MyWorkGroupedTasks = Record<MyWorkTimeGroup, any[]>;

const WEEK_OPTS = { weekStartsOn: 1 as const };

export function parseWorkbenchTask(raw: any): any {
  return {
    ...raw,
    spaces:
      typeof raw.spaces === "string"
        ? JSON.parse(raw.spaces)
        : raw.spaces || [],
    themes:
      typeof raw.themes === "string"
        ? JSON.parse(raw.themes)
        : raw.themes || [],
    teams:
      typeof raw.teams === "string" ? JSON.parse(raw.teams) : raw.teams || [],
  };
}

export function isIncompleteTask(task: { status?: string | null }): boolean {
  const s = task.status ?? "";
  return s !== "completed" && s !== "archived";
}

export function isCompletedTask(task: { status?: string | null }): boolean {
  return task.status === "completed";
}

/** Prefer `due_at`, then `due_date`; invalid/missing → null. */
export function getTaskDueDate(task: {
  due_at?: string | null;
  due_date?: string | null;
}): Date | null {
  const raw = task.due_at || task.due_date;
  if (!raw) return null;
  const d = new Date(raw);
  return isValid(d) ? d : null;
}

function dueSortKey(task: any): number {
  const d = getTaskDueDate(task);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

function completedSortKey(task: any): number {
  const raw = task.updated_at || task.created_at;
  if (!raw) return 0;
  const d = new Date(raw);
  return isValid(d) ? d.getTime() : 0;
}

export function filterTasksByPropertyScope(
  tasks: any[],
  selectedPropertyIds: Set<string> | undefined,
  totalPropertyCount: number
): any[] {
  if (
    !selectedPropertyIds ||
    selectedPropertyIds.size === 0 ||
    selectedPropertyIds.size >= totalPropertyCount
  ) {
    return tasks;
  }
  return tasks.filter(
    (t) => t.property_id && selectedPropertyIds.has(t.property_id)
  );
}

/**
 * Bucket incomplete tasks by due date (local calendar) and completed tasks separately.
 *
 * Assumptions:
 * - Calendar week starts Monday (`weekStartsOn: 1`), aligned with Filla calendar UI.
 * - Day boundaries use local `startOfDay` / `endOfDay`.
 * - Tasks without a due date are excluded from Overdue / Today / This Week.
 * - `blocked` counts as incomplete and follows the same due-date rules.
 */
export function groupMyWorkTasks(tasks: any[]): MyWorkGroupedTasks {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(todayStart, WEEK_OPTS);

  const overdue: any[] = [];
  const today: any[] = [];
  const thisWeek: any[] = [];
  const completed: any[] = [];

  for (const task of tasks) {
    if (isCompletedTask(task)) {
      completed.push(task);
      continue;
    }
    if (!isIncompleteTask(task)) continue;

    const due = getTaskDueDate(task);
    if (!due) continue;

    const dueDay = startOfDay(due);

    if (dueDay < todayStart) {
      overdue.push(task);
    } else if (dueDay <= todayEnd) {
      today.push(task);
    } else if (dueDay <= weekEnd) {
      thisWeek.push(task);
    }
  }

  overdue.sort((a, b) => dueSortKey(a) - dueSortKey(b));
  today.sort((a, b) => dueSortKey(a) - dueSortKey(b));
  thisWeek.sort((a, b) => dueSortKey(a) - dueSortKey(b));
  completed.sort((a, b) => completedSortKey(b) - completedSortKey(a));

  return { overdue, today, thisWeek, completed };
}

export function groupMyWorkTasksForScope(
  tasks: any[],
  selectedPropertyIds?: Set<string>,
  propertyCount = 0
): MyWorkGroupedTasks {
  const parsed = tasks.map(parseWorkbenchTask);
  const scoped = filterTasksByPropertyScope(
    parsed,
    selectedPropertyIds,
    propertyCount || parsed.length
  );
  return groupMyWorkTasks(scoped);
}
