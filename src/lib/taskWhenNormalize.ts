/**
 * Normalize task milestone JSON into WhenSection's MilestoneItem shape.
 * Create/intake historically used { id, dateTime, label }; some rows use { name, date }.
 */

import type { MilestoneItem } from "@/components/tasks/create/WhenSection";
import type { RepeatRule } from "@/types/database";
import { applyWeekendPushToDate, resolveWeekendPush } from "@/lib/repeatWeekendPush";

function parseAnchorDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

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

/** Pull a repeat rule from task_recurrence join, metadata, or legacy fields. */
export function getTaskRepeatRule(task: {
  repeat_rule?: unknown;
  repeatRule?: unknown;
  metadata?: unknown;
}): RepeatRule | undefined {
  const direct = parseRepeatRule(task.repeat_rule ?? task.repeatRule);
  if (direct) return direct;
  const meta = task.metadata;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    return parseRepeatRule(m.repeat ?? m.recurrence_rule);
  }
  return undefined;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Advance one interval and apply weekend push when the landing day is a weekend. */
export function advanceDateByRepeatRule(from: Date, rule: RepeatRule): Date {
  const n = Math.max(1, rule.interval || 1);
  const next = new Date(from);
  if (rule.type === "daily") next.setDate(next.getDate() + n);
  else if (rule.type === "weekly") next.setDate(next.getDate() + n * 7);
  else if (rule.type === "monthly") next.setMonth(next.getMonth() + n);
  else next.setFullYear(next.getFullYear() + n);

  const push = resolveWeekendPush(rule, toLocalDateKey(next)) === true;
  return applyWeekendPushToDate(next, push);
}

/** Advance from a due date (or now) by one repeat interval for task_recurrence.next_run. */
export function nextRunFromRepeatRule(dueDate: string | null | undefined, rule: RepeatRule): string {
  const base = parseAnchorDate(dueDate) ?? new Date();
  const start = Number.isNaN(base.getTime()) ? new Date() : base;
  return advanceDateByRepeatRule(start, rule).toISOString();
}

export type ExpandRepeatOptions = {
  /** Include the anchor due date when it falls in range (default true). */
  includeAnchor?: boolean;
  /** Safety cap (default 400). */
  maxOccurrences?: number;
};

/**
 * Expand a repeat rule into local `yyyy-MM-dd` keys within [rangeStart, rangeEnd].
 * Display-only — does not create task rows.
 */
export function expandRepeatOccurrenceDateKeys(
  anchorDue: string | null | undefined,
  rule: RepeatRule,
  rangeStart: Date,
  rangeEnd: Date,
  options?: ExpandRepeatOptions
): string[] {
  const includeAnchor = options?.includeAnchor !== false;
  const maxOccurrences = options?.maxOccurrences ?? 400;
  const start = startOfLocalDay(rangeStart);
  const end = startOfLocalDay(rangeEnd);
  if (end < start) return [];

  const anchor = parseAnchorDate(anchorDue ?? null);
  if (!anchor || Number.isNaN(anchor.getTime())) return [];

  const keys: string[] = [];
  let cursor = startOfLocalDay(anchor);
  const anchorKey = toLocalDateKey(cursor);
  let guard = 0;

  // Fast-forward until we reach the visible window.
  while (cursor < start && guard < maxOccurrences) {
    const next = startOfLocalDay(advanceDateByRepeatRule(cursor, rule));
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
    guard += 1;
  }

  while (cursor <= end && keys.length < maxOccurrences) {
    const key = toLocalDateKey(cursor);
    const isAnchor = key === anchorKey;
    if ((includeAnchor || !isAnchor) && cursor >= start) {
      keys.push(key);
    }
    const next = startOfLocalDay(advanceDateByRepeatRule(cursor, rule));
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }

  return keys;
}

/** Default horizon for mini / month calendars: 1 month back, 12 months forward. */
export function defaultRepeatCalendarRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 13, 0);
  return { start, end };
}
