import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";

/** Distinct local days the workbench was opened before rotating All-tasks art. */
export const ALL_TASKS_ILLUSTRATION_USAGE_DAYS_PER_ROTATION = 3;

export const ALL_TASKS_ILLUSTRATION_PRIMARY = ISSUES_WORKBENCH_SECTION_ILLUSTRATION.allTasks;

export const ALL_TASKS_ILLUSTRATION_ALTERNATES = [
  "/issues-workbench/all-tasks1.png",
  "/issues-workbench/all-tasks2.png",
  "/issues-workbench/all-tasks3.png",
  "/issues-workbench/all-tasks4.png",
  "/issues-workbench/all-tasks5.png",
  "/issues-workbench/all-tasks6.png",
  "/issues-workbench/all-tasks7.png",
  "/issues-workbench/all-tasks8.png",
] as const;

/** Primary first, then numbered alternates. */
export const ALL_TASKS_ILLUSTRATION_POOL = [
  ALL_TASKS_ILLUSTRATION_PRIMARY,
  ...ALL_TASKS_ILLUSTRATION_ALTERNATES,
] as const;

export const ALL_TASKS_ILLUSTRATION_STORAGE_KEY = "filla:all-tasks-illustration";

export type AllTasksIllustrationState = {
  lastDayKey: string;
  usageCount: number;
  index: number;
  randomized: boolean;
  lastAdvanceUsageCount: number;
};

type KvStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultAllTasksIllustrationState(): AllTasksIllustrationState {
  return {
    lastDayKey: "",
    usageCount: 0,
    index: 0,
    randomized: false,
    lastAdvanceUsageCount: 0,
  };
}

function clampIndex(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  const max = ALL_TASKS_ILLUSTRATION_POOL.length - 1;
  return Math.min(Math.floor(index), max);
}

export function parseAllTasksIllustrationState(raw: string | null): AllTasksIllustrationState {
  const fallback = defaultAllTasksIllustrationState();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<AllTasksIllustrationState>;
    return {
      lastDayKey: typeof parsed.lastDayKey === "string" ? parsed.lastDayKey : "",
      usageCount: Number.isFinite(parsed.usageCount) ? Math.max(0, Math.floor(parsed.usageCount as number)) : 0,
      index: clampIndex(parsed.index as number),
      randomized: parsed.randomized === true,
      lastAdvanceUsageCount: Number.isFinite(parsed.lastAdvanceUsageCount)
        ? Math.max(0, Math.floor(parsed.lastAdvanceUsageCount as number))
        : 0,
    };
  } catch {
    return fallback;
  }
}

export function pickAllTasksIllustrationIndex(
  currentIndex: number,
  random: () => number = Math.random
): number {
  const n = ALL_TASKS_ILLUSTRATION_POOL.length;
  if (n <= 1) return 0;
  let next = currentIndex;
  let guard = 0;
  while (next === currentIndex && guard < 12) {
    next = Math.floor(random() * n);
    guard += 1;
  }
  if (next === currentIndex) {
    next = (currentIndex + 1) % n;
  }
  return next;
}

/**
 * Count today as a Filla usage day, then rotate All-tasks art:
 * sequential primary → alternates 1–8, then a random pick every few usage days.
 */
export function applyAllTasksIllustrationUsage(
  state: AllTasksIllustrationState,
  todayKey: string,
  random: () => number = Math.random
): AllTasksIllustrationState {
  let { lastDayKey, usageCount, index, randomized, lastAdvanceUsageCount } = state;
  index = clampIndex(index);

  if (todayKey && todayKey !== lastDayKey) {
    usageCount += 1;
    lastDayKey = todayKey;
  }

  const interval = ALL_TASKS_ILLUSTRATION_USAGE_DAYS_PER_ROTATION;
  const lastPoolIndex = ALL_TASKS_ILLUSTRATION_POOL.length - 1;

  while (usageCount - lastAdvanceUsageCount > interval) {
    lastAdvanceUsageCount += interval;
    if (!randomized) {
      if (index < lastPoolIndex) {
        index += 1;
      } else {
        randomized = true;
        index = pickAllTasksIllustrationIndex(index, random);
      }
    } else {
      index = pickAllTasksIllustrationIndex(index, random);
    }
  }

  return { lastDayKey, usageCount, index, randomized, lastAdvanceUsageCount };
}

export function allTasksIllustrationSrc(index: number): string {
  return ALL_TASKS_ILLUSTRATION_POOL[clampIndex(index)];
}

function browserStore(): KvStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAllTasksIllustrationState(store: KvStore | null = browserStore()): AllTasksIllustrationState {
  if (!store) return defaultAllTasksIllustrationState();
  try {
    return parseAllTasksIllustrationState(store.getItem(ALL_TASKS_ILLUSTRATION_STORAGE_KEY));
  } catch {
    return defaultAllTasksIllustrationState();
  }
}

export function writeAllTasksIllustrationState(
  state: AllTasksIllustrationState,
  store: KvStore | null = browserStore()
): void {
  if (!store) return;
  try {
    store.setItem(ALL_TASKS_ILLUSTRATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

/** Record a usage day and return the illustration that should show now. */
export function touchAllTasksIllustrationUsage(
  now = new Date(),
  random: () => number = Math.random,
  store: KvStore | null = browserStore()
): string {
  const next = applyAllTasksIllustrationUsage(
    readAllTasksIllustrationState(store),
    localDayKey(now),
    random
  );
  writeAllTasksIllustrationState(next, store);
  return allTasksIllustrationSrc(next.index);
}
