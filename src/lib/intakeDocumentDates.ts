/**
 * Important dates and next steps extracted from Add Record document scans.
 * AI output is untrusted — dates must normalise; never invent.
 */

import { normalizeIntakeExpiryDate } from "@/lib/mapIntakeDocumentType";

export type IntakeDateKind =
  | "action_deadline"
  | "expiry"
  | "next_due"
  | "service"
  | "issued"
  | "collected"
  | "received"
  | "other";

/** Urgency order: corrective deadlines outrank renewals, renewals outrank informational dates. */
export const DATE_KIND_PRIORITY: Record<IntakeDateKind, number> = {
  action_deadline: 0,
  expiry: 1,
  next_due: 2,
  service: 3,
  issued: 4,
  collected: 5,
  received: 6,
  other: 7,
};

export type IntakeImportantDate = {
  id: string;
  label: string;
  date: string;
  kind: IntakeDateKind;
  /** Suggested default for reminder creation */
  remindByDefault: boolean;
};

export type IntakeFindingStatus = "pass" | "fail" | "info";

/** A statement of fact from the document — recorded, never actioned directly. */
export type IntakeScanFinding = {
  id: string;
  text: string;
  status: IntakeFindingStatus;
};

/** A consequential action the user can authorise (task / reminder). */
export type IntakeScanAction = {
  id: string;
  text: string;
  /** ISO due date parsed from the action text or attached corrective deadline. */
  deadline: string | null;
  /** Safety-critical: take out of service, isolate, stop use, etc. */
  immediate: boolean;
  kind: "action" | "reminder";
  selectedByDefault: boolean;
};

const DATE_KIND_LABELS: Record<IntakeDateKind, string> = {
  action_deadline: "Action deadline",
  expiry: "Expiry",
  next_due: "Next due",
  service: "Service date",
  issued: "Report issued",
  collected: "Collected",
  received: "Received",
  other: "Date",
};

const LABELLED_DATE_PATTERNS: Array<{
  kind: IntakeDateKind;
  label: string;
  re: RegExp;
  remindByDefault: boolean;
}> = [
  {
    kind: "action_deadline",
    label: "Action deadline",
    re: /(?:repair(?:s|ed)?\s+(?:must\s+be\s+)?(?:required\s+)?(?:completed\s+)?(?:by|before)|action\s+required\s+(?:by|before)|remed(?:y|ial\s+works?)\s+(?:by|before)|rectif(?:y|ied|ication)\s+(?:by|before)|corrective\s+actions?\s+(?:by|before)|required\s+before|à\s+corriger\s+avant(?:\s+le)?|avant\s+le)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: true,
  },
  {
    kind: "next_due",
    label: "Next due",
    re: /(?:next\s+(?:due|test|service|inspection|visit)|re-?sample(?:\s+by)?|follow[-\s]?up)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: true,
  },
  {
    kind: "expiry",
    label: "Expiry",
    re: /(?:valid\s+until|expiry|expires|expiration|renew(?:al)?(?:\s+by)?)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: true,
  },
  {
    kind: "issued",
    label: "Report issued",
    re: /(?:report\s+issued|issued|date\s+of\s+issue)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: false,
  },
  {
    kind: "collected",
    label: "Collected",
    re: /(?:collected|sample\s+date|sampling\s+date)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: false,
  },
  {
    kind: "received",
    label: "Received",
    re: /(?:received|lab\s+received)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: false,
  },
  {
    kind: "service",
    label: "Service date",
    re: /(?:service(?:d)?(?:\s+on)?|inspected(?:\s+on)?)[\s:.-]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/gi,
    remindByDefault: false,
  },
];

function slugId(prefix: string, value: string, index: number): string {
  return `${prefix}-${value}-${index}`;
}

function parseKind(raw: unknown): IntakeDateKind {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (
    v === "action_deadline" ||
    v === "expiry" ||
    v === "next_due" ||
    v === "service" ||
    v === "issued" ||
    v === "collected" ||
    v === "received" ||
    v === "other"
  ) {
    return v;
  }
  if (/correct|repair|remed|rectif|deadline/.test(v)) return "action_deadline";
  if (/due|renew|reinspect|re-?sample/.test(v)) return "next_due";
  if (/expir|valid/.test(v)) return "expiry";
  if (/issu/.test(v)) return "issued";
  if (/collect|sampl/.test(v)) return "collected";
  if (/receiv/.test(v)) return "received";
  if (/service|inspect/.test(v)) return "service";
  return "other";
}

export function remindByDefaultForKind(kind: IntakeDateKind): boolean {
  return kind === "action_deadline" || kind === "expiry" || kind === "next_due";
}

export function labelForDateKind(kind: IntakeDateKind, custom?: string | null): string {
  const trimmed = custom?.trim();
  if (trimmed) return trimmed.slice(0, 80);
  return DATE_KIND_LABELS[kind];
}

/** Normalise AI `important_dates` array; drop invented / invalid dates. */
export function normalizeImportantDates(
  raw: unknown,
  fallbackExpiry?: string | null
): IntakeImportantDate[] {
  const out: IntakeImportantDate[] = [];
  const seen = new Set<string>();

  const push = (label: string, dateRaw: string | null | undefined, kind: IntakeDateKind) => {
    const date = normalizeIntakeExpiryDate(dateRaw);
    if (!date) return;
    const key = `${kind}:${date}:${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: slugId("date", `${kind}-${date}`, out.length),
      label: labelForDateKind(kind, label),
      date,
      kind,
      remindByDefault: remindByDefaultForKind(kind),
    });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const kind = parseKind(row.kind ?? row.type ?? row.role);
      const label =
        typeof row.label === "string"
          ? row.label
          : typeof row.name === "string"
            ? row.name
            : labelForDateKind(kind);
      const dateRaw =
        (typeof row.date === "string" && row.date) ||
        (typeof row.value === "string" && row.value) ||
        null;
      push(label, dateRaw, kind);
    }
  }

  if (fallbackExpiry) {
    push("Expiry / renewal", fallbackExpiry, "expiry");
  }

  return out.slice(0, 12);
}

/** Deterministic multi-date extraction from OCR when the model under-reports dates. */
export function extractImportantDatesFromOcr(text?: string | null): IntakeImportantDate[] {
  if (!text?.trim()) return [];
  const out: IntakeImportantDate[] = [];
  const seen = new Set<string>();

  for (const pattern of LABELLED_DATE_PATTERNS) {
    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.re.exec(text)) !== null) {
      const date = normalizeIntakeExpiryDate(match[1]);
      if (!date) continue;
      const key = `${pattern.kind}:${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: slugId("ocr", key, out.length),
        label: pattern.label,
        date,
        kind: pattern.kind,
        remindByDefault: pattern.remindByDefault,
      });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

/**
 * Date-first dedupe: when the same calendar date arrives with multiple semantic
 * kinds (model vs OCR disagreement), keep one entry with the highest-priority
 * kind. Sorted by urgency: corrective deadlines → renewals → informational.
 */
export function mergeImportantDates(
  primary: IntakeImportantDate[],
  secondary: IntakeImportantDate[]
): IntakeImportantDate[] {
  const byDate = new Map<string, IntakeImportantDate>();
  for (const item of [...primary, ...secondary]) {
    const existing = byDate.get(item.date);
    if (!existing || DATE_KIND_PRIORITY[item.kind] < DATE_KIND_PRIORITY[existing.kind]) {
      byDate.set(item.date, item);
    }
  }
  const out = [...byDate.values()]
    .sort(
      (a, b) =>
        DATE_KIND_PRIORITY[a.kind] - DATE_KIND_PRIORITY[b.kind] ||
        a.date.localeCompare(b.date)
    )
    .slice(0, 12)
    .map((item, index) => ({
      ...item,
      id: slugId("merged", `${item.kind}:${item.date}`, index),
    }));
  return out;
}

const FAIL_FINDING =
  /non[\s_-]?conform|not\s+conform|unsatisfactory|\bfail(?:ed|ure)?\b|action\s+required|anomal|major\s+(?:defect|non)|défaut|defect|hazard|danger|unreliable|does\s+not\s+(?:reliably\s+)?(?:connect|work|function|operate)|out\s+of\s+service|legionella|\bhigh\b/i;
const PASS_FINDING =
  /\bconform(?:e|s|ing|ant)?\b|satisfactory|\bpass(?:ed)?\b|acceptable|compliant|no\s+defects?|within\s+(?:limits|tolerance)|\bok\b/i;

/**
 * Findings are recorded facts, never actions. Accepts model output as plain
 * strings or `{ text, status }` objects; classifies conservatively when the
 * model gave no status.
 */
export function normalizeFindings(raw: unknown): IntakeScanFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: IntakeScanFinding[] = [];
  for (const item of raw) {
    let text = "";
    let status: IntakeFindingStatus | null = null;
    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      text = typeof row.text === "string" ? row.text : "";
      const s = String(row.status ?? "").toLowerCase();
      if (s === "pass" || s === "fail" || s === "info") status = s;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 8 || text.length > 240) continue;
    if (out.some((f) => f.text.toLowerCase() === text.toLowerCase())) continue;
    if (!status) {
      status = FAIL_FINDING.test(text) ? "fail" : PASS_FINDING.test(text) ? "pass" : "info";
    }
    out.push({ id: slugId("finding", String(out.length), out.length), text, status });
    if (out.length >= 10) break;
  }
  return out;
}

const IMMEDIATE_ACTION =
  /immediat|out\s+of\s+service|stop\s+use|do\s+not\s+use|isolate|urgent|hors\s+service|sans\s+délai|compensatory\s+surveillance/i;

/**
 * Required actions come from the model's recommendations only (never findings).
 * A deadline printed inside the action text is parsed; otherwise the caller may
 * attach the document's corrective deadline.
 */
export function normalizeRequiredActions(
  recommendations: unknown,
  outcome?: string | null
): IntakeScanAction[] {
  if (!Array.isArray(recommendations)) return [];
  const critical =
    !!outcome && /unsatisfactory|fail|expired|action\s+required|non[\s_-]?conforme|high/i.test(outcome);
  const out: IntakeScanAction[] = [];
  for (const item of recommendations) {
    if (typeof item !== "string") continue;
    const text = item.replace(/\s+/g, " ").trim();
    if (text.length < 8 || text.length > 240) continue;
    if (out.some((a) => a.text.toLowerCase() === text.toLowerCase())) continue;
    const dateMatch = text.match(
      /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/
    );
    const deadline = dateMatch ? normalizeIntakeExpiryDate(dateMatch[1]) : null;
    const immediate = IMMEDIATE_ACTION.test(text);
    out.push({
      id: slugId("action", String(out.length), out.length),
      text,
      deadline,
      immediate,
      kind: "action",
      selectedByDefault: critical || immediate || out.length < 3,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Primary renewal date for the compliance record itself. Corrective deadlines
 * deliberately excluded — they drive tasks, not the record's expiry field.
 */
export function primaryExpiryFromDates(dates: IntakeImportantDate[]): string | null {
  const preferred =
    dates.find((d) => d.kind === "expiry") ||
    dates.find((d) => d.kind === "next_due");
  return preferred?.date ?? null;
}

/** Earliest corrective/action deadline, if the document imposed one. */
export function primaryActionDeadlineFromDates(dates: IntakeImportantDate[]): string | null {
  const deadlines = dates
    .filter((d) => d.kind === "action_deadline")
    .sort((a, b) => a.date.localeCompare(b.date));
  return deadlines[0]?.date ?? null;
}

export function formatIntakeDateDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}
