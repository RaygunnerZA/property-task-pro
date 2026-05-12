/**
 * Pure helpers for schedule conflict copy in CreateTaskModal.
 * Kept out of the modal shell to shrink the monolith without changing behaviour.
 */

export function minuteKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

type TaskLike = {
  title?: unknown;
  description?: unknown;
  themes?: unknown;
};

export function includesMeetingSignal(task: TaskLike | null | undefined): boolean {
  const text = `${task?.title ?? ""} ${task?.description ?? ""}`.toLowerCase();
  if (/\bmeeting\b|\bmeet[-\s]?up\b|\bstandup\b|\bsync\b/.test(text)) return true;

  let themes: unknown[] = [];
  if (Array.isArray(task?.themes)) {
    themes = task.themes;
  } else if (typeof task?.themes === "string") {
    try {
      themes = JSON.parse(task.themes) as unknown[];
    } catch {
      themes = [];
    }
  }

  return themes.some((theme) => {
    const themeName = String((theme as { name?: unknown })?.name ?? "").toLowerCase();
    return themeName.includes("meeting");
  });
}
