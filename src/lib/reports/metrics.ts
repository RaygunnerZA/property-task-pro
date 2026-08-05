import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import type { SignalRow } from "@/lib/signals/signalTypes";
import {
  formatPeriodBucket,
  inRange,
  resolveDateRange,
  type DateRange,
} from "./dateRange";
import type {
  ReportAttentionItem,
  ReportComplianceRow,
  ReportDateRangePreset,
  ReportKpis,
  ReportSpaceRow,
  ReportTaskRow,
  ReportTrendPoint,
} from "./types";

const TERMINAL = new Set(["completed", "archived", "done"]);

export type ReportTaskLike = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  spaces?: unknown;
};

export type ReportComplianceLike = {
  id?: string | null;
  title?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  expiry_date?: string | null;
  next_due_date?: string | null;
  expiry_state?: string | null;
  status?: string | null;
};

function isOpen(task: ReportTaskLike): boolean {
  return !TERMINAL.has((task.status ?? "").toLowerCase());
}

function isCompleted(task: ReportTaskLike): boolean {
  const s = (task.status ?? "").toLowerCase();
  return s === "completed" || s === "done";
}

function parseSpaces(spaces: unknown): { id?: string; name?: string }[] {
  if (!spaces) return [];
  try {
    const raw = typeof spaces === "string" ? JSON.parse(spaces) : spaces;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function filterTasksByPropertyScope(
  tasks: ReportTaskLike[],
  propertyIds: string[],
  allPropertyIds: string[]
): ReportTaskLike[] {
  const scopeAll =
    propertyIds.length === 0 || propertyIds.length >= allPropertyIds.length;
  if (scopeAll) return tasks;
  const set = new Set(propertyIds);
  return tasks.filter((t) => t.property_id && set.has(t.property_id));
}

export function filterComplianceByPropertyScope(
  items: ReportComplianceLike[],
  propertyIds: string[],
  allPropertyIds: string[]
): ReportComplianceLike[] {
  const scopeAll =
    propertyIds.length === 0 || propertyIds.length >= allPropertyIds.length;
  if (scopeAll) return items;
  const set = new Set(propertyIds);
  return items.filter((c) => c.property_id && set.has(c.property_id));
}

export function filterSignalsByPropertyScope(
  signals: SignalRow[],
  propertyIds: string[],
  allPropertyIds: string[]
): SignalRow[] {
  const scopeAll =
    propertyIds.length === 0 || propertyIds.length >= allPropertyIds.length;
  if (scopeAll) return signals;
  const set = new Set(propertyIds);
  return signals.filter((s) => s.property_id && set.has(s.property_id));
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeReportKpis(
  tasks: ReportTaskLike[],
  compliance: ReportComplianceLike[],
  signals: SignalRow[],
  range: DateRange
): ReportKpis {
  const open = tasks.filter(isOpen);
  const overdue = open.filter((t) => getTaskDueUrgency(t) === "overdue");
  const dueSoon = open.filter((t) => getTaskDueUrgency(t) === "due_soon");
  const highPriority = open.filter((t) => {
    const p = (t.priority ?? "").toLowerCase();
    return p === "urgent" || p === "high";
  });

  const completedInRange = tasks.filter((t) => {
    if (!isCompleted(t)) return false;
    return inRange(t.updated_at ?? t.created_at, range.start, range.end);
  });

  const today = new Date().toISOString().split("T")[0];
  const expiringSoon = compliance.filter((c) => {
    const d = c.expiry_date ?? c.next_due_date;
    if (!d || d < today) return false;
    return daysUntil(d) <= 30;
  });
  const expiredOrOverdueCompliance = compliance.filter((c) => {
    const state = (c.expiry_state ?? c.status ?? "").toLowerCase();
    if (state.includes("expired") || state.includes("overdue")) return true;
    const d = c.expiry_date ?? c.next_due_date;
    return !!d && d < today;
  });

  const highRiskSignals = signals.filter((s) => {
    const sev = String(s.severity ?? "").toLowerCase();
    return sev === "high" || sev === "critical" || sev === "urgent";
  });

  const needsAttention = new Set<string>();
  for (const t of overdue) if (t.id) needsAttention.add(`task:${t.id}`);
  for (const t of highPriority) if (t.id) needsAttention.add(`task:${t.id}`);
  for (const c of expiredOrOverdueCompliance) if (c.id) needsAttention.add(`comp:${c.id}`);
  for (const s of highRiskSignals) needsAttention.add(`sig:${s.id}`);

  return {
    needsAttention: needsAttention.size,
    completed: completedInRange.length,
    overdue: overdue.length,
    upcoming: dueSoon.length + expiringSoon.length,
  };
}

export function computeReportTrend(
  tasks: ReportTaskLike[],
  preset: ReportDateRangePreset,
  range: DateRange
): ReportTrendPoint[] {
  const map = new Map<string, ReportTrendPoint>();

  const ensure = (date: Date) => {
    const { key, label } = formatPeriodBucket(date, preset);
    let row = map.get(key);
    if (!row) {
      row = { key, label, created: 0, completed: 0 };
      map.set(key, row);
    }
    return row;
  };

  // Seed empty buckets across the range for stable charts
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    ensure(cursor);
    cursor.setDate(cursor.getDate() + (preset === "7d" ? 1 : preset === "30d" ? 7 : 14));
  }
  ensure(range.end);

  for (const t of tasks) {
    if (t.created_at && inRange(t.created_at, range.start, range.end)) {
      ensure(new Date(t.created_at)).created += 1;
    }
    if (isCompleted(t) && inRange(t.updated_at ?? t.created_at, range.start, range.end)) {
      const iso = t.updated_at ?? t.created_at;
      if (iso) ensure(new Date(iso)).completed += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function computeAttentionItems(
  tasks: ReportTaskLike[],
  compliance: ReportComplianceLike[],
  signals: SignalRow[],
  limit = 8
): ReportAttentionItem[] {
  const items: ReportAttentionItem[] = [];

  for (const t of tasks.filter(isOpen)) {
    const urgency = getTaskDueUrgency(t);
    const high =
      urgency === "overdue" ||
      ["urgent", "high"].includes((t.priority ?? "").toLowerCase());
    if (!high || !t.id) continue;
    items.push({
      id: t.id,
      kind: "task",
      title: (t.title ?? "Untitled task").trim(),
      detail:
        urgency === "overdue"
          ? "Overdue work"
          : `Priority: ${t.priority ?? "high"}`,
      severity: urgency === "overdue" ? "high" : "medium",
    });
  }

  const today = new Date().toISOString().split("T")[0];
  for (const c of compliance) {
    if (!c.id) continue;
    const d = c.expiry_date ?? c.next_due_date;
    const state = (c.expiry_state ?? "").toLowerCase();
    const expired = (d && d < today) || state.includes("expired");
    const soon = d && d >= today && daysUntil(d) <= 30;
    if (!expired && !soon) continue;
    items.push({
      id: c.id,
      kind: "compliance",
      title: (c.title ?? "Compliance item").trim(),
      detail: expired
        ? `Expired${d ? ` ${d}` : ""}`
        : `Expires in ${daysUntil(d!)} day${daysUntil(d!) === 1 ? "" : "s"}`,
      severity: expired ? "high" : "medium",
    });
  }

  for (const s of signals.slice(0, 10)) {
    const sev = String(s.severity ?? "medium").toLowerCase();
    items.push({
      id: s.id,
      kind: "signal",
      title: (s.title || s.body || "Signal").trim(),
      detail: "Open signal",
      severity: sev === "high" || sev === "critical" ? "high" : "medium",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, limit);
}

export function computeTaskRows(
  tasks: ReportTaskLike[],
  limit = 12
): ReportTaskRow[] {
  const open = tasks.filter(isOpen);
  const ranked = [...open].sort((a, b) => {
    const ua = getTaskDueUrgency(a) === "overdue" ? 0 : getTaskDueUrgency(a) === "due_soon" ? 1 : 2;
    const ub = getTaskDueUrgency(b) === "overdue" ? 0 : getTaskDueUrgency(b) === "due_soon" ? 1 : 2;
    return ua - ub;
  });

  return ranked.slice(0, limit).map((t) => ({
    id: t.id ?? "",
    title: (t.title ?? "Untitled").trim(),
    status: t.status ?? "open",
    propertyName: t.property_name ?? null,
    dueDate: t.due_date ?? null,
    urgency: getTaskDueUrgency(t),
  }));
}

export function computeComplianceRows(
  compliance: ReportComplianceLike[],
  limit = 12
): ReportComplianceRow[] {
  const today = new Date().toISOString().split("T")[0];
  const scored = [...compliance].sort((a, b) => {
    const da = a.expiry_date ?? a.next_due_date ?? "9999";
    const db = b.expiry_date ?? b.next_due_date ?? "9999";
    return da.localeCompare(db);
  });

  return scored
    .filter((c) => {
      const d = c.expiry_date ?? c.next_due_date;
      if (!d) return true;
      return d <= today || daysUntil(d) <= 60;
    })
    .slice(0, limit)
    .map((c) => ({
      id: c.id ?? "",
      title: (c.title ?? "Compliance item").trim(),
      propertyName: c.property_name ?? null,
      expiryDate: c.expiry_date ?? c.next_due_date ?? null,
      expiryState: c.expiry_state ?? c.status ?? null,
    }));
}

/** Property-scoped only: most active spaces by linked open task count. */
export function computeActiveSpaces(
  tasks: ReportTaskLike[],
  limit = 6
): ReportSpaceRow[] {
  const counts = new Map<string, number>();
  for (const t of tasks.filter(isOpen)) {
    for (const space of parseSpaces(t.spaces)) {
      const name = (space.name ?? "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, taskCount]) => ({ name, taskCount }))
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, limit);
}

export function buildLiveReportData(input: {
  tasks: ReportTaskLike[];
  compliance: ReportComplianceLike[];
  signals: SignalRow[];
  propertyIds: string[];
  allPropertyIds: string[];
  preset: ReportDateRangePreset;
}) {
  const range = resolveDateRange(input.preset);
  const tasks = filterTasksByPropertyScope(
    input.tasks,
    input.propertyIds,
    input.allPropertyIds
  );
  const compliance = filterComplianceByPropertyScope(
    input.compliance,
    input.propertyIds,
    input.allPropertyIds
  );
  const signals = filterSignalsByPropertyScope(
    input.signals,
    input.propertyIds,
    input.allPropertyIds
  );

  const kpis = computeReportKpis(tasks, compliance, signals, range);
  const previousKpis = computeReportKpis(
    tasks,
    compliance,
    signals,
    {
      ...range,
      start: range.previous.start,
      end: range.previous.end,
    }
  );

  return {
    range,
    kpis,
    previousKpis,
    trend: computeReportTrend(tasks, input.preset, range),
    attention: computeAttentionItems(tasks, compliance, signals),
    taskRows: computeTaskRows(tasks),
    complianceRows: computeComplianceRows(compliance),
    spaceRows: computeActiveSpaces(tasks),
    scopedTaskCount: tasks.length,
  };
}
