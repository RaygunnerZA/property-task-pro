/** Marker in staff training task descriptions (matches DB seed). */
export const STAFF_TRAINING_MARKER = "[staff_training]";

export function isStaffTrainingTask(task: {
  description?: string | null;
  title?: string | null;
}): boolean {
  if (
    typeof task.description === "string" &&
    task.description.includes(STAFF_TRAINING_MARKER)
  ) {
    return true;
  }
  return typeof task.title === "string" && task.title.startsWith("Learn Filla:");
}

export function userHasStaffTrainingTasks(
  tasks: Array<{ assigned_user_id?: string | null; description?: string | null; title?: string | null }>,
  userId: string
): boolean {
  return tasks.some(
    (t) =>
      t.assigned_user_id === userId && isStaffTrainingTask(t)
  );
}

export function staffTrainingBannerStorageKey(userId: string): string {
  return `staff-training-banner-dismissed:${userId}`;
}
