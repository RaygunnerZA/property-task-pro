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
  options?: { opaque?: boolean }
): string {
  const { baseColor, isSeriesColor } = resolveCalendarChipColor(task);
  if (options?.opaque) {
    // Solid pastel so stacked / fanned chips don't ghost text through each other.
    const paperAmount = isSeriesColor
      ? isRepeatOccurrence
        ? 0.72
        : 0.55
      : isRepeatOccurrence
        ? 0.82
        : 0.68;
    return mixHexColors(baseColor, CHIP_PAPER, paperAmount);
  }
  if (isSeriesColor) {
    return calendarTypeColorWithAlpha(baseColor, isRepeatOccurrence ? 0.34 : 0.44);
  }
  return calendarTypeColorWithAlpha(baseColor, isRepeatOccurrence ? 0.16 : 0.35);
}
