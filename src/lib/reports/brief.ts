import type { SignalRow } from "@/lib/signals/signalTypes";
import type {
  ReportComplianceLike,
  ReportKpis,
  ReportTaskLike,
} from "./metrics";
import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import type { ReportTemplateId } from "./types";

const TERMINAL = new Set(["completed", "archived", "done"]);

function isOpen(task: ReportTaskLike): boolean {
  return !TERMINAL.has((task.status ?? "").toLowerCase());
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Rule-based consultant brief for Reports foyer / workspace.
 * Not an LLM call — grounded in live counts so claims stay auditable.
 */
export function buildReportBriefParagraph(input: {
  templateId?: ReportTemplateId;
  scopeLabel: string;
  periodLabel: string;
  kpis: ReportKpis;
  previousKpis?: ReportKpis;
  tasks: ReportTaskLike[];
  compliance: ReportComplianceLike[];
  signals: SignalRow[];
}): string {
  const {
    scopeLabel,
    periodLabel,
    kpis,
    previousKpis,
    tasks,
    compliance,
    signals,
    templateId = "executive",
  } = input;

  const sentences: string[] = [];

  if (previousKpis && previousKpis.completed > 0) {
    const delta =
      ((kpis.completed - previousKpis.completed) / previousKpis.completed) * 100;
    if (Math.abs(delta) >= 8) {
      const dir = delta < 0 ? "fallen" : "risen";
      sentences.push(
        `Over ${periodLabel.toLowerCase()}, completed work has ${dir} ${Math.abs(Math.round(delta))}% for ${scopeLabel}.`
      );
    }
  }

  if (sentences.length === 0) {
    if (kpis.overdue === 0 && kpis.needsAttention === 0) {
      sentences.push(
        `${scopeLabel} is operating calmly over ${periodLabel.toLowerCase()} — no overdue work needs attention right now.`
      );
    } else {
      sentences.push(
        `${scopeLabel} has ${kpis.needsAttention} item${kpis.needsAttention === 1 ? "" : "s"} needing attention over ${periodLabel.toLowerCase()}.`
      );
    }
  }

  if (kpis.overdue > 0) {
    sentences.push(
      `${kpis.overdue} overdue task${kpis.overdue === 1 ? "" : "s"} require follow-up.`
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const nextExpiry = [...compliance]
    .filter((c) => {
      const d = c.expiry_date ?? c.next_due_date;
      return d && d >= today;
    })
    .sort((a, b) =>
      (a.expiry_date ?? a.next_due_date ?? "").localeCompare(
        b.expiry_date ?? b.next_due_date ?? ""
      )
    )[0];

  if (nextExpiry) {
    const d = nextExpiry.expiry_date ?? nextExpiry.next_due_date!;
    const days = daysUntil(d);
    const label = (nextExpiry.title ?? "A certificate").trim();
    sentences.push(
      `${label} expires in ${days} day${days === 1 ? "" : "s"}.`
    );
  }

  if (
    (templateId === "maintenance" || templateId === "executive") &&
    signals[0]
  ) {
    const title = (signals[0].title || signals[0].body || "A signal").trim();
    sentences.push(`${title} is still open.`);
  }

  if (templateId === "maintenance") {
    const recurring = findRecurringTheme(tasks);
    if (recurring) {
      sentences.push(recurring);
    }
  }

  return sentences.slice(0, 4).join(" ");
}

function findRecurringTheme(tasks: ReportTaskLike[]): string | null {
  const open = tasks.filter(isOpen);
  const keywords = [
    { key: "plumb", label: "plumbing" },
    { key: "leak", label: "leak" },
    { key: "electr", label: "electrical" },
    { key: "hvac", label: "HVAC" },
    { key: "boiler", label: "boiler" },
  ];
  for (const { key, label } of keywords) {
    const hits = open.filter((t) =>
      (t.title ?? "").toLowerCase().includes(key)
    );
    if (hits.length >= 2) {
      const overdue = hits.filter((t) => getTaskDueUrgency(t) === "overdue");
      if (overdue.length > 0) {
        return `${hits.length} recurring ${label} issues remain, including overdue work.`;
      }
      return `${hits.length} recurring ${label} issues remain unresolved.`;
    }
  }
  return null;
}

export function buildFoyerBriefLines(input: {
  scopeLabel: string;
  periodLabel: string;
  kpis: ReportKpis;
  previousKpis?: ReportKpis;
  tasks: ReportTaskLike[];
  compliance: ReportComplianceLike[];
  signals: SignalRow[];
}): string {
  return buildReportBriefParagraph({ ...input, templateId: "executive" });
}
