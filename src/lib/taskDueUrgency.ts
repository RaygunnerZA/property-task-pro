export type TaskDueUrgency = "overdue" | "due_soon";

const TERMINAL_STATUSES = new Set(["completed", "archived"]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Days ahead (from today) that still count as due soon — matches work schedule “next 7 days” bucket. */
const DUE_SOON_HORIZON_DAYS = 7;

/**
 * Returns overdue / due-soon urgency for open-work task cards.
 * Overdue takes precedence; due soon is any due date within the next 7 days (inclusive of today).
 */
export function getTaskDueUrgency(task: {
  due_date?: string | null;
  status?: string | null;
}): TaskDueUrgency | null {
  const dueRaw = task.due_date;
  if (!dueRaw) return null;

  const status = (task.status ?? "").toLowerCase();
  if (TERMINAL_STATUSES.has(status)) return null;

  const today = startOfDay(new Date());
  const dueDay = startOfDay(new Date(dueRaw));

  if (dueDay < today) return "overdue";

  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + DUE_SOON_HORIZON_DAYS);
  if (dueDay < horizonEnd) return "due_soon";

  return null;
}

/** Display text for the image-panel chip (no bracket notation). */
export function taskDueUrgencyLabel(urgency: TaskDueUrgency): string {
  if (urgency === "overdue") return "OVERDUE";
  return "DUE SOON";
}

/** Human-readable due line for task cards, e.g. "Due in 2 days" or "Overdue by 1 day". */
export function formatTaskDueRelative(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;

  const today = startOfDay(new Date());
  const dueDay = startOfDay(new Date(dueDate));
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`;
  }
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}
