import { format, parseISO, isValid } from "date-fns";

export type DayPeriod = "morning" | "afternoon" | "untimed";
export type PlacementSource = "due" | "milestone";

export type CalendarTaskPlacement = {
  /** Unique id for dnd-kit */
  id: string;
  task: Record<string, unknown>;
  dateKey: string;
  period: DayPeriod;
  source: PlacementSource;
  milestoneId?: string;
};

export const CALENDAR_MORNING_TIME = "09:00";
export const CALENDAR_AFTERNOON_TIME = "14:00";

export function parseScheduleDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return isValid(date) ? date : null;
    }
    const parsed = parseISO(trimmed);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** True when the value carries an explicit time (not midnight date-only). */
export function hasExplicitTime(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const dt = parseScheduleDateTime(trimmed);
  if (!dt) return false;
  return dt.getHours() !== 0 || dt.getMinutes() !== 0;
}

export function getDayPeriodFromDateTime(dt: Date | null, raw?: string | null): DayPeriod {
  if (!dt) return "untimed";
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return "untimed";
  if (dt.getHours() === 0 && dt.getMinutes() === 0) return "untimed";
  return dt.getHours() < 12 ? "morning" : "afternoon";
}

export function getPeriodFromScheduleValue(value: string | null | undefined): DayPeriod {
  const dt = parseScheduleDateTime(value ?? null);
  return getDayPeriodFromDateTime(dt, value);
}

export function formatScheduleDateTime(date: Date, period: "morning" | "afternoon"): string {
  const dateStr = format(date, "yyyy-MM-dd");
  const time = period === "morning" ? CALENDAR_MORNING_TIME : CALENDAR_AFTERNOON_TIME;
  return `${dateStr}T${time}`;
}

export function parsePlacementDragId(id: string): {
  taskId: string;
  source: PlacementSource;
  milestoneId?: string;
} | null {
  const parts = id.split(":");
  if (parts.length < 2) return null;
  const [taskId, source] = parts;
  if (source === "due") return { taskId, source: "due" };
  if (source === "milestone" && parts[2]) {
    return { taskId, source: "milestone", milestoneId: parts[2] };
  }
  return null;
}

export function makePlacementDragId(
  taskId: string,
  source: PlacementSource,
  milestoneId?: string
): string {
  return source === "milestone" && milestoneId
    ? `${taskId}:milestone:${milestoneId}`
    : `${taskId}:due`;
}

function parseMilestones(task: Record<string, unknown>): Array<{ id: string; dateTime: string; label?: string }> {
  const raw = task.milestones;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<{ id: string; dateTime: string; label?: string }>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function buildCalendarPlacements(tasks: unknown[]): CalendarTaskPlacement[] {
  const placements: CalendarTaskPlacement[] = [];
  const seen = new Set<string>();

  for (const raw of tasks) {
    const task = raw as Record<string, unknown>;
    const taskId = String(task.id ?? "");
    if (!taskId) continue;

    const add = (value: string, source: PlacementSource, milestoneId?: string) => {
      const dt = parseScheduleDateTime(value);
      if (!dt) return;
      const dragId = makePlacementDragId(taskId, source, milestoneId);
      if (seen.has(dragId)) return;
      seen.add(dragId);
      placements.push({
        id: dragId,
        task,
        dateKey: format(dt, "yyyy-MM-dd"),
        period: getPeriodFromScheduleValue(value),
        source,
        milestoneId,
      });
    };

    const due = (task.due_date || task.due_at) as string | undefined;
    if (due) add(due, "due");

    parseMilestones(task).forEach((m) => {
      if (m?.dateTime) add(m.dateTime, "milestone", m.id);
    });
  }

  return placements;
}

export function groupPlacementsByDate(
  placements: CalendarTaskPlacement[]
): Map<string, CalendarTaskPlacement[]> {
  const map = new Map<string, CalendarTaskPlacement[]>();
  for (const p of placements) {
    const list = map.get(p.dateKey) ?? [];
    list.push(p);
    map.set(p.dateKey, list);
  }
  map.forEach((list, key) => {
    list.sort((a, b) => {
      const rank = (period: DayPeriod) => {
        if (period === "morning") return 0;
        if (period === "afternoon") return 1;
        return 2;
      };
      const pr = rank(a.period) - rank(b.period);
      if (pr !== 0) return pr;
      return String(a.task.title ?? "").localeCompare(String(b.task.title ?? ""));
    });
    map.set(key, list);
  });
  return map;
}

export function buildScheduleUpdate(
  task: Record<string, unknown>,
  source: PlacementSource,
  milestoneId: string | undefined,
  targetDate: Date,
  period: "morning" | "afternoon"
): { due_date?: string | null; milestones?: Array<{ id: string; dateTime: string; label?: string }> } {
  const dateTime = formatScheduleDateTime(targetDate, period);

  if (source === "milestone" && milestoneId) {
    const milestones = parseMilestones(task);
    return {
      milestones: milestones.map((m) =>
        m.id === milestoneId ? { ...m, dateTime } : m
      ),
    };
  }

  return { due_date: dateTime };
}

export function parseDropTargetId(id: string): { dateKey: string; period: "morning" | "afternoon" } | null {
  if (!id.startsWith("drop|")) return null;
  const parts = id.split("|");
  if (parts.length !== 3) return null;
  const period = parts[2];
  if (period !== "morning" && period !== "afternoon") return null;
  return { dateKey: parts[1], period };
}

export function makeDropTargetId(dateKey: string, period: "morning" | "afternoon"): string {
  return `drop|${dateKey}|${period}`;
}
