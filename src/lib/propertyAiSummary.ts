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
const LOG_PREFIX =
  /\b(accidentally|deleted|uploaded|created|updated|removed|failed|error|log)\b/i;
const TASK_TITLE_VERB = /^(review|check|upload|create|inspect|complete|add|fix)\b/i;

function isOpenTask(task: TaskLike): boolean {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

function isUrgentPriority(task: TaskLike): boolean {
  const pr = (task.priority ?? "").toLowerCase();
  return pr === "urgent" || pr === "high";
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function taskIdOrUndefined(task: TaskLike): string | undefined {
  return typeof task.id === "string" && task.id.length > 0 ? task.id : undefined;
}

function taskTarget(task: TaskLike, fallbackFilter: string): PropertyAiSummaryTarget {
  const taskId = taskIdOrUndefined(task);
  return taskId ? { type: "task", taskId } : { type: "filter", filterId: fallbackFilter };
}

function isReviewSignal(signal: SignalRow): boolean {
  const disposition = (signal.disposition ?? "").toLowerCase();
  const severity = (signal.severity ?? "").toLowerCase();
  return (
    disposition === "needs_review" ||
    disposition === "urgent" ||
    severity === "critical" ||
    severity === "urgent"
  );
}

/**
 * Turn a stored task/signal title into a noun Filla can speak.
 * Strips log-style prefixes ("Accidentally deleted asset - …") and trailing status clauses.
 */
export function briefTaskSubject(title: string): string {
  let text = title.trim().replace(/[.]+$/g, "");
  text = text.replace(/\s+needs (attention|review|a decision)\.?$/i, "").trim();
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const left = parts[0]?.trim() ?? "";
    const right = parts.slice(1).join(" — ").trim();
    if (right && LOG_PREFIX.test(left)) return right;
  }
  return text;
}

function referToSubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return "this task";
  if (/^(the|a|an)\s/i.test(trimmed)) return trimmed;
  if (TASK_TITLE_VERB.test(trimmed) || (trimmed[0] === trimmed[0]?.toUpperCase() && trimmed.split(/\s+/).length > 3)) {
    return trimmed;
  }
  return `the ${trimmed}`;
}

function urgentTaskLine(urgent: TaskLike[]): PropertyAiSummaryLine | null {
  const first = urgent.find((t) => (t.title ?? "").trim());
  if (!first?.title) return null;
  const subject = referToSubject(briefTaskSubject(first.title));
  const target = taskTarget(first, "show-tasks-urgent");
  if (urgent.length === 1) {
    return { text: `Open this next: ${subject}.`, target };
  }
  return {
    text: `${urgent.length} urgent tasks are open. Start with ${subject}.`,
    target,
  };
}

function signalSummaryLine(signal: SignalRow, propertyName?: string): PropertyAiSummaryLine {
  const item = mapSignalRowToAttentionItem(signal, propertyName);
  const snapshot = attentionItemToSignalSnapshot(item);
  const subject = briefTaskSubject(item.title.trim() || "an update");
  return {
    text: `Worth a review: ${referToSubject(subject)}.`,
    target: { type: "signal", signalId: signal.id, snapshot },
  };
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

  const reviewSignals = signals.filter(isReviewSignal);
  if (lines.length < 3 && reviewSignals[0]) {
    lines.push(signalSummaryLine(reviewSignals[0], propertyName));
  }

  const ingressReports = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const title = (t.title ?? "").toLowerCase();
    return title.includes("water ingress") || title.includes("ingress");
  });
  if (ingressReports.length > 0) {
    lines.push({
      text: `${ingressReports.length} water ingress report${ingressReports.length === 1 ? "" : "s"} require review.`,
      target: taskTarget(ingressReports[0], "show-tasks"),
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
    lines.push({
      text: "Garden maintenance is overdue.",
      target: taskTarget(overdueMaintenance[0], "show-to-review"),
    });
  }

  const urgent = tasks
    .filter((t) => isOpenTask(t) && isUrgentPriority(t))
    .sort((a, b) => {
      const rank = (p?: string | null) => ((p ?? "").toLowerCase() === "urgent" ? 0 : 1);
      return rank(a.priority) - rank(b.priority);
    });
  if (lines.length < 3) {
    const urgentLine = urgentTaskLine(urgent);
    if (urgentLine) lines.push(urgentLine);
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

  const urgent = openTasks.filter(isUrgentPriority);
  const urgentLine = urgentTaskLine(urgent);
  if (urgentLine) lines.push(urgentLine);

  const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
  if (lines.length < 3 && overdue.length > 0) {
    lines.push({
      text: `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across your portfolio.`,
      target: { type: "filter", filterId: "show-to-review" },
    });
  }

  const reviewSignals = signals.filter(isReviewSignal);
  if (lines.length < 3 && reviewSignals[0]) {
    lines.push(signalSummaryLine(reviewSignals[0]));
  }

  if (lines.length === 0) {
    if (openTasks.length === 0) {
      return [{ text: "No open work across your properties right now." }];
    }
    return [{ text: "You're up to date — nothing urgent needs action today." }];
  }

  return lines.slice(0, 3);
}
