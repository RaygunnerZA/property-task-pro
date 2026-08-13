/**
 * Normalize task milestone JSON into WhenSection's MilestoneItem shape.
 * Create/intake historically used { id, dateTime, label }; some rows use { name, date }.
 */

import type { MilestoneItem } from "@/components/tasks/create/WhenSection";
import type { RepeatRule } from "@/types/database";
import { applyWeekendPushToDate, resolveWeekendPush } from "@/lib/repeatWeekendPush";

export function normalizeTaskMilestones(raw: unknown): MilestoneItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  }

  return arr
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const m = item as Record<string, unknown>;
      const id = typeof m.id === "string" && m.id ? m.id : `milestone-${index}`;
      const dateTimeRaw =
        (typeof m.dateTime === "string" && m.dateTime) ||
        (typeof m.date === "string" && m.date) ||
        "";
      if (!dateTimeRaw) return null;
      const dateTime = dateTimeRaw.includes("T") ? dateTimeRaw : `${dateTimeRaw}T09:00`;
      const label =
        (typeof m.label === "string" && m.label.trim()) ||
        (typeof m.name === "string" && m.name.trim()) ||
        undefined;
      return { id, dateTime, label } satisfies MilestoneItem;
    })
    .filter(Boolean) as MilestoneItem[];
}

export function parseRepeatRule(raw: unknown): RepeatRule | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (type !== "daily" && type !== "weekly" && type !== "monthly" && type !== "yearly") {
    return undefined;
  }
  const interval =
    typeof r.interval === "number" && r.interval > 0 ? r.interval : Number(r.interval) || 1;
  return {
    type,
    interval: Math.max(1, Math.min(99, interval)),
    ...(typeof r.day === "string" ? { day: r.day } : {}),
    ...(typeof r.weekend_push === "boolean" ? { weekend_push: r.weekend_push } : {}),
  };
}

/** Advance from a due date (or now) by one repeat interval for task_recurrence.next_run. */
export function nextRunFromRepeatRule(dueDate: string | null | undefined, rule: RepeatRule): string {
  const base = dueDate ? new Date(dueDate) : new Date();
  const start = Number.isNaN(base.getTime()) ? new Date() : base;
  const n = Math.max(1, rule.interval || 1);
  const next = new Date(start);
  if (rule.type === "daily") next.setDate(next.getDate() + n);
  else if (rule.type === "weekly") next.setDate(next.getDate() + n * 7);
  else if (rule.type === "monthly") next.setMonth(next.getMonth() + n);
  else next.setFullYear(next.getFullYear() + n);

  const push = resolveWeekendPush(rule, dueDate) === true;
  return applyWeekendPushToDate(next, push).toISOString();
}
