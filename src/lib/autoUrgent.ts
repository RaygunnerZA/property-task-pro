/**
 * Client preference: treat open tasks as urgent when their due date is inside a horizon.
 * Does not rewrite `tasks.priority` — classification only (Urgent tab, counts, chips).
 */

export const AUTO_URGENT_HORIZONS = [
  { id: "off", label: "Off", hint: "Only tasks marked urgent or high" },
  { id: "overdue", label: "Overdue", hint: "Already past due" },
  { id: "today", label: "Due today", hint: "Overdue or due today" },
  { id: "2d", label: "2 days", hint: "Due within 2 days" },
  { id: "7d", label: "7 days", hint: "Due within a week" },
] as const;

export type AutoUrgentHorizonId = (typeof AUTO_URGENT_HORIZONS)[number]["id"];

/** Default: imminently overdue — due today or already late. */
export const DEFAULT_AUTO_URGENT_HORIZON: AutoUrgentHorizonId = "today";

const STORAGE_PREFIX = "filla.autoUrgentHorizon.";
const listeners = new Set<() => void>();

const TERMINAL_STATUSES = new Set(["completed", "archived", "done"]);

export function isAutoUrgentHorizonId(value: unknown): value is AutoUrgentHorizonId {
  return (
    typeof value === "string" &&
    AUTO_URGENT_HORIZONS.some((horizon) => horizon.id === value)
  );
}

export function autoUrgentStorageKey(orgId: string): string {
  return `${STORAGE_PREFIX}${orgId}`;
}

function emitAutoUrgentChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeAutoUrgentHorizon(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function readAutoUrgentHorizon(orgId: string | null | undefined): AutoUrgentHorizonId {
  if (!orgId || typeof window === "undefined") return DEFAULT_AUTO_URGENT_HORIZON;
  try {
    const raw = window.localStorage.getItem(autoUrgentStorageKey(orgId));
    return isAutoUrgentHorizonId(raw) ? raw : DEFAULT_AUTO_URGENT_HORIZON;
  } catch {
    return DEFAULT_AUTO_URGENT_HORIZON;
  }
}

export function writeAutoUrgentHorizon(
  orgId: string,
  horizonId: AutoUrgentHorizonId
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(autoUrgentStorageKey(orgId), horizonId);
  } catch {
    // Ignore quota / private-mode failures; preference simply won't persist.
  }
  emitAutoUrgentChange();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDueDay(dueRaw: string | null | undefined): Date | null {
  if (!dueRaw) return null;
  const due = new Date(dueRaw);
  if (Number.isNaN(due.getTime())) return null;
  return startOfDay(due);
}

export function hasStoredUrgentPriority(priority: string | null | undefined): boolean {
  const pr = (priority ?? "").toLowerCase();
  return pr === "urgent" || pr === "high";
}

function isOpenTaskStatus(status: string | null | undefined): boolean {
  return !TERMINAL_STATUSES.has((status ?? "").toLowerCase());
}

function matchesDueHorizon(
  task: { due_date?: string | null; due_at?: string | null },
  horizon: AutoUrgentHorizonId,
  now: Date
): boolean {
  if (horizon === "off") return false;
  const dueDay = parseDueDay(task.due_date ?? task.due_at);
  if (!dueDay) return false;

  const today = startOfDay(now);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (horizon === "overdue") return diffDays < 0;
  if (horizon === "today") return diffDays <= 0;
  if (horizon === "2d") return diffDays <= 2;
  if (horizon === "7d") return diffDays >= 0 ? diffDays < 7 : true;
  return false;
}

/** Due-date classification only — does not include stored urgent/high. */
export function isDueDateAutoUrgent(
  task: {
    due_date?: string | null;
    due_at?: string | null;
    status?: string | null;
  },
  horizon: AutoUrgentHorizonId = DEFAULT_AUTO_URGENT_HORIZON,
  now: Date = new Date()
): boolean {
  if (!isOpenTaskStatus(task.status)) return false;
  return matchesDueHorizon(task, horizon, now);
}

/**
 * True when an open task should appear in the Urgent queue:
 * stored urgent/high, or due date inside the selected horizon.
 */
export function isTaskEffectivelyUrgent(
  task: {
    priority?: string | null;
    due_date?: string | null;
    due_at?: string | null;
    status?: string | null;
  },
  horizon: AutoUrgentHorizonId = DEFAULT_AUTO_URGENT_HORIZON,
  now: Date = new Date()
): boolean {
  if (!isOpenTaskStatus(task.status)) return false;
  if (hasStoredUrgentPriority(task.priority)) return true;
  return matchesDueHorizon(task, horizon, now);
}
