/** How tasks open on wide (layout+) screens. Mobile always uses the modal. */
export type TaskOpenMode = "panel" | "fullscreen";

export const TASK_OPEN_MODE_STORAGE_KEY = "filla.taskOpenMode";
export const DEFAULT_TASK_OPEN_MODE: TaskOpenMode = "panel";

export function parseTaskOpenMode(value: unknown): TaskOpenMode {
  return value === "fullscreen" ? "fullscreen" : "panel";
}

export function readStoredTaskOpenMode(): TaskOpenMode {
  if (typeof window === "undefined") return DEFAULT_TASK_OPEN_MODE;
  try {
    return parseTaskOpenMode(window.localStorage.getItem(TASK_OPEN_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_TASK_OPEN_MODE;
  }
}

export function writeStoredTaskOpenMode(mode: TaskOpenMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASK_OPEN_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}
