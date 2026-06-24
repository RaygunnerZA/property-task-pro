import { attentionItemToSignalSnapshot } from "@/components/dashboard/issues/issuesAttentionItem";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { mapSignalRowToAttentionItem } from "@/lib/signals/mapSignalRowToAttentionItem";
import type { SignalRow } from "@/lib/signals/signalTypes";
import { getTaskDueUrgency } from "@/lib/taskDueUrgency";

type TaskLike = {
  id?: string;
  status?: string | null;
  priority?: string | null;
  title?: string | null;
  due_date?: string | null;
  due_at?: string | null;
};

export type PropertyAiSummaryTarget =
  | { type: "task"; taskId: string }
  | { type: "document"; documentId: string }
  | { type: "filter"; filterId: string }
  | {
      type: "signal";
      signalId: string;
      snapshot: ReturnType<typeof attentionItemToSignalSnapshot>;
    };

export type PropertyAiSummaryLine = {
  text: string;
  target?: PropertyAiSummaryTarget;
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

function signalSummaryLine(signal: SignalRow, propertyName?: string): PropertyAiSummaryLine {
  const item = mapSignalRowToAttentionItem(signal, propertyName);
  const snapshot = attentionItemToSignalSnapshot(item);
  return {
    text: `${item.title.trim()} needs review.`,
    target: { type: "signal", signalId: signal.id, snapshot },
  };
}

function taskIdOrUndefined(task: TaskLike): string | undefined {
  return typeof task.id === "string" && task.id.length > 0 ? task.id : undefined;
}

/** Short property-scoped briefing lines for the identity card (max 3). */
export function getPropertyAiSummaryLines(
  tasks: TaskLike[],
  documents: PropertyDocument[],
  signals: SignalRow[] = [],
  propertyName?: string
): PropertyAiSummaryLine[] {
  const lines: PropertyAiSummaryLine[] = [];
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
    lines.push({
      text: `${label} expires in ${days} day${days === 1 ? "" : "s"}.`,
      target: { type: "document", documentId: expiringDoc.id },
    });
  }

  const ingressReports = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const title = (t.title ?? "").toLowerCase();
    return title.includes("water ingress") || title.includes("ingress");
  });
  if (ingressReports.length > 0) {
    const firstTaskId = taskIdOrUndefined(ingressReports[0]);
    lines.push({
      text: `${ingressReports.length} water ingress report${ingressReports.length === 1 ? "" : "s"} require review.`,
      target: firstTaskId
        ? { type: "task", taskId: firstTaskId }
        : { type: "filter", filterId: "show-tasks" },
    });
  }

  const overdueMaintenance = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const title = (t.title ?? "").toLowerCase();
    const isGarden =
      title.includes("garden") || title.includes("lawn") || title.includes("maintenance");
    return isGarden && getTaskDueUrgency(t) === "overdue";
  });
  if (overdueMaintenance.length > 0) {
    const firstTaskId = taskIdOrUndefined(overdueMaintenance[0]);
    lines.push({
      text: "Garden maintenance is overdue.",
      target: firstTaskId
        ? { type: "task", taskId: firstTaskId }
        : { type: "filter", filterId: "show-to-review" },
    });
  }

  const urgent = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  });
  if (lines.length < 3 && urgent[0]?.title) {
    const taskId = taskIdOrUndefined(urgent[0]);
    lines.push({
      text: `${urgent[0].title.trim()} needs attention.`,
      target: taskId
        ? { type: "task", taskId }
        : { type: "filter", filterId: "show-tasks-urgent" },
    });
  }

  if (lines.length < 3 && signals[0]) {
    lines.push(signalSummaryLine(signals[0], propertyName));
  }

  if (lines.length === 0) {
    const open = tasks.filter(isOpenTask);
    if (open.length === 0) {
      return [{ text: "No open work on this property right now." }];
    }
    return [{ text: "You're up to date — nothing urgent needs action today." }];
  }

  return lines.slice(0, 3);
}

/** Portfolio-wide briefing lines for the home "All properties" carousel card. */
export function getAllPropertiesSummaryLines(
  tasks: TaskLike[],
  _propertyCount: number,
  signals: SignalRow[] = []
): PropertyAiSummaryLine[] {
  const lines: PropertyAiSummaryLine[] = [];
  const openTasks = tasks.filter(isOpenTask);

  const urgent = openTasks.filter((t) => {
    const pr = (t.priority ?? "").toLowerCase();
    return pr === "urgent" || pr === "high";
  });

  if (urgent.length > 0 && urgent[0]?.title) {
    const taskId = taskIdOrUndefined(urgent[0]);
    lines.push({
      text: `${urgent[0].title.trim()} needs attention.`,
      target: taskId
        ? { type: "task", taskId }
        : { type: "filter", filterId: "show-tasks-urgent" },
    });
  }

  const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
  if (lines.length < 3 && overdue.length > 0) {
    lines.push({
      text: `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across your portfolio.`,
      target: { type: "filter", filterId: "show-to-review" },
    });
  }

  if (lines.length < 3 && signals[0]) {
    lines.push(signalSummaryLine(signals[0]));
  }

  if (lines.length === 0) {
    if (openTasks.length === 0) {
      return [{ text: "No open work across your properties right now." }];
    }
    return [{ text: "You're up to date — nothing urgent needs action today." }];
  }

  return lines.slice(0, 3);
}
