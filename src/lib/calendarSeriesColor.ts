/**
 * Stable per-series colors for recurring calendar tasks.
 * One hue per parent task id — anchor and repeat occurrences share it.
 */

import {
  calendarTypeColorWithAlpha,
  getCalendarTypeColor,
  inferCalendarType,
  mixHexColors,
} from "@/lib/calendarTypes";
import { getTaskRepeatRule } from "@/lib/taskWhenNormalize";

/** Warm paper card tone — mix target for opaque stacked chips. */
const CHIP_PAPER = "#FBFAF8";
/** Soft ink for darkening cards further back in a hand. */
const CHIP_STACK_INK = "#2C2A28";

/** Priority fills for one-off (non-recurring) chips. */
const PRIORITY_CHIP_COLORS: Record<string, string> = {
  urgent: "#EB6834", // coral
  high: "#E8A04A", // amber
  low: "#9AA8AE", // muted slate
};

/** Distinct, accessible hues aligned with Filla tokens. */
export const RECURRING_TASK_SERIES_PALETTE = [
  "#8EC9CE", // teal (primary)
  "#EB6834", // coral (destructive)
  "#9B8EC9", // purple (inspections)
  "#6B9FD4", // blue (projects)
  "#E8A04A", // amber (compliance)
  "#7CB87C", // green
  "#D47B9B", // rose
  "#5A9A9E", // deep teal
  "#C97B5A", // terracotta
  "#7A8EC9", // periwinkle
  "#B88EC9", // lavender
  "#4FA8A0", // jade
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getRecurringTaskSeriesColor(taskId: string): string {
  if (!taskId) return RECURRING_TASK_SERIES_PALETTE[0];
  const index = hashString(taskId) % RECURRING_TASK_SERIES_PALETTE.length;
  return RECURRING_TASK_SERIES_PALETTE[index];
}

export function taskHasRecurrence(task: Record<string, unknown>): boolean {
  return Boolean(getTaskRepeatRule(task));
}

export function resolveCalendarChipColor(task: Record<string, unknown>): {
  baseColor: string;
  isSeriesColor: boolean;
} {
  const taskId = String(task.id ?? "");
  if (taskHasRecurrence(task)) {
    return { baseColor: getRecurringTaskSeriesColor(taskId), isSeriesColor: true };
  }

  const priority =
    typeof task.priority === "string" ? task.priority.trim().toLowerCase() : "";
  const priorityColor = PRIORITY_CHIP_COLORS[priority];
  if (priorityColor) {
    return { baseColor: priorityColor, isSeriesColor: false };
  }

  const title = typeof task.title === "string" ? task.title : null;
  const themes = task.themes as
    | Array<{ name?: string; type?: string }>
    | string
    | undefined;
  return {
    baseColor: getCalendarTypeColor(inferCalendarType({ title, themes })),
    isSeriesColor: false,
  };
}

export function resolveCalendarChipBackground(
  task: Record<string, unknown>,
  isRepeatOccurrence: boolean,
  options?: {
    opaque?: boolean;
    /** 0 = furthest back in the hand (darkest); higher = closer to front. */
    stackIndex?: number;
    stackCount?: number;
  }
): string {
  const { baseColor, isSeriesColor } = resolveCalendarChipColor(task);
  const stackCount = Math.max(1, options?.stackCount ?? 1);
  const stackIndex = Math.min(
    Math.max(0, options?.stackIndex ?? 0),
    stackCount - 1
  );
  // Earlier / back cards sit further in the fan — slightly darker than the front.
  const backness =
    stackCount > 1 ? (stackCount - 1 - stackIndex) / (stackCount - 1) : 0;

  if (options?.opaque) {
    // Solid pastel so stacked / fanned chips don't ghost text through each other.
    // Recurring series keep one stable fill (anchor + occurrences match).
    let paperAmount = isSeriesColor
      ? 0.58
      : isRepeatOccurrence
        ? 0.82
        : 0.68;
    // Depth tint only for one-offs — recurring stays the same colour in a hand.
    if (!isSeriesColor && backness > 0) {
      paperAmount = Math.max(0.4, paperAmount - backness * 0.14);
      const pastel = mixHexColors(baseColor, CHIP_PAPER, paperAmount);
      return mixHexColors(pastel, CHIP_STACK_INK, backness * 0.1);
    }
    return mixHexColors(baseColor, CHIP_PAPER, paperAmount);
  }
  if (isSeriesColor) {
    // Same alpha for every occurrence of a series.
    return calendarTypeColorWithAlpha(baseColor, 0.4);
  }
  const alphaBoost = backness * 0.08;
  return calendarTypeColorWithAlpha(
    baseColor,
    Math.min(0.55, (isRepeatOccurrence ? 0.16 : 0.35) + alphaBoost)
  );
}
