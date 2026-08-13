import { parseISO } from "date-fns";
import type { RepeatRule } from "@/types/database";

/** Saturday or Sunday for a due date string (`YYYY-MM-DD` or ISO datetime). */
export function isWeekendDueDate(dueDate: string | null | undefined): boolean {
  if (!dueDate?.trim()) return false;
  const raw = dueDate.trim();
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? parseISO(`${raw}T12:00:00`)
      : parseISO(raw);
    if (Number.isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 0 || day === 6;
  } catch {
    return false;
  }
}

/**
 * Default for the "Push to Monday?" checkbox when the due date is a weekend:
 * daily / monthly / yearly → checked; weekly → unchecked.
 */
export function defaultWeekendPush(type: RepeatRule["type"]): boolean {
  return type !== "weekly";
}

export function resolveWeekendPush(
  rule: Pick<RepeatRule, "type" | "weekend_push">,
  dueDate: string | null | undefined
): boolean | undefined {
  if (!isWeekendDueDate(dueDate)) return undefined;
  if (typeof rule.weekend_push === "boolean") return rule.weekend_push;
  return defaultWeekendPush(rule.type);
}

/** Move Sat→Mon (+2) or Sun→Mon (+1). No-op for weekdays or when push is off. */
export function applyWeekendPushToDate(date: Date, weekendPush: boolean): Date {
  if (!weekendPush) return date;
  const next = new Date(date);
  const day = next.getDay();
  if (day === 6) next.setDate(next.getDate() + 2);
  else if (day === 0) next.setDate(next.getDate() + 1);
  return next;
}
