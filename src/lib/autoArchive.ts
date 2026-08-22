/** Client preference for auto-archiving completed tasks (localStorage; no DB column). */

export const AUTO_ARCHIVE_INTERVALS = [
  { id: "1d", label: ">24HRS", days: 1 },
  { id: "3d", label: "3 DAYS", days: 3 },
  { id: "weekly", label: "WEEKLY", days: 7 },
] as const;

export type AutoArchiveIntervalId = (typeof AUTO_ARCHIVE_INTERVALS)[number]["id"];

const STORAGE_PREFIX = "filla.autoArchiveInterval.";

export function isAutoArchiveIntervalId(value: unknown): value is AutoArchiveIntervalId {
  return (
    typeof value === "string" &&
    AUTO_ARCHIVE_INTERVALS.some((interval) => interval.id === value)
  );
}

export function autoArchiveStorageKey(orgId: string): string {
  return `${STORAGE_PREFIX}${orgId}`;
}

export function readAutoArchiveInterval(orgId: string | null | undefined): AutoArchiveIntervalId | null {
  if (!orgId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(autoArchiveStorageKey(orgId));
    return isAutoArchiveIntervalId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeAutoArchiveInterval(
  orgId: string,
  intervalId: AutoArchiveIntervalId | null
): void {
  if (typeof window === "undefined") return;
  try {
    const key = autoArchiveStorageKey(orgId);
    if (intervalId == null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, intervalId);
    }
  } catch {
    // Ignore quota / private-mode failures; preference simply won't persist.
  }
}

export function intervalDays(intervalId: AutoArchiveIntervalId): number {
  const match = AUTO_ARCHIVE_INTERVALS.find((interval) => interval.id === intervalId);
  return match?.days ?? 7;
}

/** True when a completed task is past the selected auto-archive window. */
export function isCompletedPastArchiveWindow(
  completedAt: string | null | undefined,
  updatedAt: string | null | undefined,
  intervalId: AutoArchiveIntervalId,
  nowMs: number = Date.now()
): boolean {
  const stamp = completedAt || updatedAt;
  if (!stamp) return false;
  const completedMs = new Date(stamp).getTime();
  if (Number.isNaN(completedMs)) return false;
  const windowMs = intervalDays(intervalId) * 24 * 60 * 60 * 1000;
  return completedMs <= nowMs - windowMs;
}
