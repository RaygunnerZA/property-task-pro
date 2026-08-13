/** Soft-deleted tasks (status `archived`) remain recoverable for this many days. */
export const TASK_TRASH_RETENTION_DAYS = 30;

export function taskTrashExpiresAt(trashedAt: string | Date): Date {
  const base = typeof trashedAt === "string" ? new Date(trashedAt) : trashedAt;
  const expires = new Date(base);
  expires.setDate(expires.getDate() + TASK_TRASH_RETENTION_DAYS);
  return expires;
}

export function taskTrashDaysRemaining(trashedAt: string | Date, now = new Date()): number {
  const ms = taskTrashExpiresAt(trashedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isTaskTrashExpired(trashedAt: string | Date, now = new Date()): boolean {
  return taskTrashExpiresAt(trashedAt).getTime() <= now.getTime();
}

export function formatTaskTrashDeleteCopy(taskTitle: string): string {
  const title = taskTitle.trim() || "this task";
  return `"${title}" will move to Trash and can be recovered for ${TASK_TRASH_RETENTION_DAYS} days. After that it is permanently deleted.`;
}
