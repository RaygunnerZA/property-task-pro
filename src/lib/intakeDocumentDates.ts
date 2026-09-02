/**
 * Important dates and next steps extracted from Add Record document scans.
 * AI output is untrusted — dates must normalise; never invent.
 */

import { normalizeIntakeExpiryDate } from "@/lib/mapIntakeDocumentType";

export type IntakeDateKind =
  | "expiry"
  | "next_due"
  | "service"
  | "issued"
  | "collected"
  | "received"
  | "other";

export type IntakeImportantDate = {
  id: string;
  label: string;
  date: string;
  kind: IntakeDateKind;
  /** Suggested default for reminder creation */
  remindByDefault: boolean;
};

export type IntakeScanNextStep = {
  id: string;
  text: string;
  /** Suggested default for follow-up task / checklist */
  selectedByDefault: boolean;
};

const DATE_KIND_LABELS: Record<IntakeDateKind, string> = {
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
  if (/due|renew|reinspect|re-?sample/.test(v)) return "next_due";
  if (/expir|valid/.test(v)) return "expiry";
  if (/issu/.test(v)) return "issued";
  if (/collect|sampl/.test(v)) return "collected";
  if (/receiv/.test(v)) return "received";
  if (/service|inspect/.test(v)) return "service";
  return "other";
}

export function remindByDefaultForKind(kind: IntakeDateKind): boolean {
  return kind === "expiry" || kind === "next_due";
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

export function mergeImportantDates(
  primary: IntakeImportantDate[],
  secondary: IntakeImportantDate[]
): IntakeImportantDate[] {
  const seen = new Set<string>();
  const out: IntakeImportantDate[] = [];
  for (const item of [...primary, ...secondary]) {
    const key = `${item.kind}:${item.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, id: slugId("merged", key, out.length) });
  }
  // Prefer actionable dates first
  out.sort((a, b) => Number(b.remindByDefault) - Number(a.remindByDefault) || a.date.localeCompare(b.date));
  return out.slice(0, 12);
}

export function normalizeNextSteps(
  findings: unknown,
  recommendations: unknown,
  outcome?: string | null
): IntakeScanNextStep[] {
  const texts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const t = value.replace(/\s+/g, " ").trim();
    if (t.length < 8 || t.length > 240) return;
    if (texts.some((existing) => existing.toLowerCase() === t.toLowerCase())) return;
    texts.push(t);
  };

  if (Array.isArray(findings)) findings.forEach(push);
  if (Array.isArray(recommendations)) recommendations.forEach(push);

  const critical =
    !!outcome &&
    /unsatisfactory|fail|expired|action\s+required|high/i.test(outcome);

  return texts.slice(0, 8).map((text, index) => ({
    id: slugId("step", String(index), index),
    text,
    selectedByDefault: critical || index < 3,
  }));
}

export function primaryExpiryFromDates(dates: IntakeImportantDate[]): string | null {
  const preferred =
    dates.find((d) => d.kind === "next_due") ||
    dates.find((d) => d.kind === "expiry") ||
    dates.find((d) => d.remindByDefault);
  return preferred?.date ?? null;
}

export function formatIntakeDateDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}
