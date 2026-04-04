import type { Database } from "@/integrations/supabase/types";

export type TasksViewRow = Database["public"]["Views"]["tasks_view"]["Row"];

/** Card shapes used by PropertyTaskCard / ComplianceTaskCard */
export type PropertyTaskCardModel = {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue?: boolean;
};

export type ComplianceTaskCardModel = PropertyTaskCardModel & {
  propertyName: string;
  ruleName: string;
  isOverdue: boolean;
  isDueToday: boolean;
  slaStatus: "on-track" | "at-risk" | "breached";
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function mapDbStatusToCardStatus(
  status: string | null
): PropertyTaskCardModel["status"] {
  if (status === "in_progress") return "in-progress";
  if (status === "completed" || status === "archived") return "completed";
  return "pending";
}

export function mapDbPriorityToCard(
  priority: string | null
): PropertyTaskCardModel["priority"] {
  const p = (priority || "normal").toLowerCase();
  if (p === "urgent" || p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}

function parseTeamsJson(teams: unknown): Array<{ name?: string }> {
  if (!teams) return [];
  try {
    const parsed =
      typeof teams === "string" ? JSON.parse(teams) : teams;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapTasksViewToPropertyTask(row: TasksViewRow): PropertyTaskCardModel {
  const dueRaw = row.due_date;
  const dueDate = dueRaw ? new Date(dueRaw) : new Date();
  const createdRaw = row.created_at;
  const createdAt = createdRaw ? new Date(createdRaw) : new Date();

  const today = startOfDay(new Date());
  const dueDay = startOfDay(dueDate);
  const st = row.status;
  const done = st === "completed" || st === "archived";
  const isOverdue = !!dueRaw && dueDay < today && !done;

  const teamNames = parseTeamsJson(row.teams)
    .map((t) => t.name)
    .filter(Boolean) as string[];

  return {
    id: row.id ?? "",
    title: row.title ?? "",
    description: row.description ?? undefined,
    status: mapDbStatusToCardStatus(row.status),
    priority: mapDbPriorityToCard(row.priority),
    dueDate,
    assignedTeam: teamNames.length ? teamNames.join(", ") : undefined,
    createdAt,
    isOverdue: isOverdue || undefined,
  };
}

export function computeSlaStatus(params: {
  dueDate: Date;
  hasDueDate: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
}): ComplianceTaskCardModel["slaStatus"] {
  if (params.isCompleted) return "on-track";
  if (params.isOverdue) return "breached";
  if (!params.hasDueDate) return "on-track";
  const ms = params.dueDate.getTime() - Date.now();
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  if (ms >= 0 && ms <= twoDays) return "at-risk";
  return "on-track";
}

export function mapTasksViewToComplianceTask(
  row: TasksViewRow,
  ruleName: string
): ComplianceTaskCardModel {
  const base = mapTasksViewToPropertyTask(row);
  const dueRaw = row.due_date;
  const dueDate = base.dueDate;
  const today = startOfDay(new Date());
  const dueDay = startOfDay(dueDate);
  const done = row.status === "completed" || row.status === "archived";
  const isOverdue = !!dueRaw && dueDay < today && !done;
  const isDueToday = !!dueRaw && dueDay.getTime() === today.getTime() && !done;

  const propertyName =
    row.property_name?.trim() ||
    row.property_address?.trim() ||
    "Property";

  return {
    ...base,
    propertyName,
    ruleName: ruleName || "Compliance rule",
    isOverdue,
    isDueToday,
    slaStatus: computeSlaStatus({
      dueDate,
      hasDueDate: !!dueRaw,
      isCompleted: done,
      isOverdue,
    }),
  };
}
