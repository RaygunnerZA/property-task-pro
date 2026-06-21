import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";

type TaskLike = {
  status?: string | null;
  priority?: string | null;
  title?: string | null;
  due_date?: string | null;
  due_at?: string | null;
};

const TERMINAL_STATUSES = new Set(["completed", "archived", "done"]);

function isOpenTask(task: TaskLike): boolean {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Short property-scoped briefing lines for the identity card (max 3). */
export function getPropertyAiSummaryLines(
  tasks: TaskLike[],
  documents: PropertyDocument[]
): string[] {
  const lines: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  const expiringDoc = documents
    .filter((d) => d.expiry_date && d.expiry_date >= today)
    .sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1))[0];

  if (expiringDoc?.expiry_date) {
    const days = daysUntil(expiringDoc.expiry_date);
    const label =
      expiringDoc.title?.trim() ||
      expiringDoc.document_type?.trim() ||
      expiringDoc.category?.trim() ||
      "A compliance document";
    lines.push(`${label} expires in ${days} day${days === 1 ? "" : "s"}.`);
  }

  const ingressReports = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const title = (t.title ?? "").toLowerCase();
    return title.includes("water ingress") || title.includes("ingress");
  });
  if (ingressReports.length > 0) {
    lines.push(
      `${ingressReports.length} water ingress report${ingressReports.length === 1 ? "" : "s"} require review.`
    );
  }

  const overdueMaintenance = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const title = (t.title ?? "").toLowerCase();
    const isGarden =
      title.includes("garden") || title.includes("lawn") || title.includes("maintenance");
    return isGarden && getTaskDueUrgency(t) === "overdue";
  });
  if (overdueMaintenance.length > 0) {
    lines.push("Garden maintenance is overdue.");
  }

  const urgent = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  });
  if (lines.length < 3 && urgent[0]?.title) {
    lines.push(`${urgent[0].title.trim()} needs attention.`);
  }

  if (lines.length === 0) {
    const open = tasks.filter(isOpenTask);
    if (open.length === 0) {
      return ["No open work on this property right now."];
    }
    return ["You're up to date — nothing urgent needs action today."];
  }

  return lines.slice(0, 3);
}

/** Portfolio-wide briefing lines for the home "All properties" carousel card. */
export function getAllPropertiesSummaryLines(
  tasks: TaskLike[],
  propertyCount: number
): string[] {
  const lines: string[] = [];
  const openTasks = tasks.filter(isOpenTask);

  const urgent = openTasks.filter((t) => {
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  });

  if (propertyCount > 1) {
    lines.push(`Overview across ${propertyCount} properties.`);
  }

  if (urgent.length > 0 && urgent[0]?.title) {
    lines.push(`${urgent[0].title.trim()} needs attention.`);
  }

  const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
  if (lines.length < 3 && overdue.length > 0) {
    lines.push(
      `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across your portfolio.`
    );
  }

  if (lines.length === 0) {
    if (openTasks.length === 0) {
      return ["No open work across your properties right now."];
    }
    return ["You're up to date — nothing urgent needs action today."];
  }

  return lines.slice(0, 3);
}
