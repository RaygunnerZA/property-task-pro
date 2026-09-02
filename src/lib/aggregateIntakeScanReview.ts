/**
 * Semantic view model for the Add Record scan review.
 * Facts (outcome, findings, dates) are presented for recording; only actions
 * (tasks, reminders) are user-confirmable. AI output is untrusted — everything
 * passes through bounded normalisers and nothing here mutates state.
 */

import {
  extractImportantDatesFromOcr,
  formatIntakeDateDisplay,
  mergeImportantDates,
  normalizeFindings,
  normalizeImportantDates,
  normalizeRequiredActions,
  primaryActionDeadlineFromDates,
  primaryExpiryFromDates,
  type IntakeImportantDate,
  type IntakeScanAction,
  type IntakeScanFinding,
} from "@/lib/intakeDocumentDates";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";
import type { TempImage } from "@/types/temp-image";

export type IntakeScanSeverity = "critical" | "attention" | "ok";

export type AggregatedIntakeScanReview = {
  /** Human display of the document outcome, e.g. "Action required". */
  outcome: string | null;
  outcomeSeverity: IntakeScanSeverity | null;
  /** Most important non-conforming finding — the headline issue. */
  primaryIssue: string | null;
  /** Deduped, urgency-sorted dates. Passive facts — no selection. */
  dates: IntakeImportantDate[];
  /** Earliest corrective deadline, if the document imposes one. */
  actionDeadline: string | null;
  /** Confirmable actions: corrective tasks + renewal reminders. */
  actions: IntakeScanAction[];
  /** Non-conforming findings beyond the primary issue. */
  failFindings: IntakeScanFinding[];
  /** Conforming / informational findings — collapsed by default. */
  otherFindings: IntakeScanFinding[];
  /** Short alert chips (kept for thumbnail badges). */
  signals: string[];
  fileCountWithScan: number;
};

const CRITICAL_OUTCOME = /unsatisfactory|fail|action_required|expired|non[\s_-]?conforme/i;
const OK_OUTCOME = /^(satisfactory|pass|valid|conforme)$/i;

function severityFromOutcome(outcome: string | null): IntakeScanSeverity | null {
  if (!outcome) return null;
  if (CRITICAL_OUTCOME.test(outcome)) return "critical";
  if (OK_OUTCOME.test(outcome.trim())) return "ok";
  return "attention";
}

function displayOutcome(outcome: string | null): string | null {
  if (!outcome) return null;
  const cleaned = outcome.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "unknown") return null;
  return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 80);
}

type PerSourceScan = {
  title: string;
  outcome: string | null;
  dates: IntakeImportantDate[];
  findings: IntakeScanFinding[];
  actions: IntakeScanAction[];
  alertLabels: string[];
};

function scanFromFile(file: PendingIntakeFile): PerSourceScan {
  return {
    title: file.scanTitle || file.display_name,
    outcome: file.scanOutcome ?? null,
    dates: file.scanImportantDates ?? [],
    findings: file.scanFindings ?? [],
    actions: file.scanActions ?? [],
    alertLabels: [],
  };
}

function scanFromImage(image: TempImage): PerSourceScan {
  const analysis = image.rawAnalysis;
  const meta = (analysis?.metadata ?? {}) as Record<string, unknown>;
  const outcome =
    analysis?.outcome ?? (typeof meta.outcome === "string" ? meta.outcome : null);

  const fromModel = normalizeImportantDates(
    analysis?.important_dates ?? meta.important_dates,
    null
  );
  const ocr = image.aiOcrText || analysis?.ocr_text || "";
  const fromOcr = extractImportantDatesFromOcr(ocr);
  let dates = mergeImportantDates(fromModel, fromOcr);

  // Classification expiry only counts when nothing labelled contradicts it.
  const classExpiry =
    analysis?.document_classification?.expiry_date ||
    (typeof meta.normalized_expiry === "string" ? meta.normalized_expiry : null);
  if (classExpiry && !dates.some((d) => d.date === classExpiry)) {
    dates = mergeImportantDates(dates, normalizeImportantDates([], classExpiry));
  }

  const findings = normalizeFindings(analysis?.findings ?? meta.findings);
  const actions = normalizeRequiredActions(
    analysis?.compliance_recommendations ?? meta.compliance_recommendations,
    outcome
  );

  const alertLabels = (analysis?.detected_labels ?? []).filter((label) =>
    /action\s*required|legionella|unsatisf|fail|hazard|critical|high|non[\s-]?conforme/i.test(label)
  );

  return {
    title: image.display_name,
    outcome,
    dates,
    findings,
    actions,
    alertLabels,
  };
}

export function aggregateIntakeScanReview(
  files: PendingIntakeFile[],
  images: TempImage[] = []
): AggregatedIntakeScanReview {
  const scannedFiles = files.filter((f) => f.scanStatus === "done");
  const scannedImages = images.filter((img) => {
    const stage = (img.rawAnalysis?.metadata as Record<string, unknown> | undefined)?.intake_stage;
    return Boolean(img.rawAnalysis) && stage !== "router";
  });

  const sources = [
    ...scannedFiles.map(scanFromFile),
    ...scannedImages.map(scanFromImage),
  ];
  const multiSource = sources.length > 1;

  const dates = mergeImportantDates(
    [],
    sources.flatMap((s, si) =>
      s.dates.map((d) => ({
        ...d,
        id: `src${si}:${d.id}`,
        label: multiSource ? `${d.label} · ${s.title.slice(0, 40)}` : d.label,
      }))
    )
  );
  const actionDeadline = primaryActionDeadlineFromDates(dates);

  // Worst outcome wins across sources.
  let outcomeRaw: string | null = null;
  let outcomeSeverity: IntakeScanSeverity | null = null;
  const rank: Record<IntakeScanSeverity, number> = { critical: 0, attention: 1, ok: 2 };
  for (const s of sources) {
    const sev = severityFromOutcome(s.outcome);
    if (!sev) continue;
    if (!outcomeSeverity || rank[sev] < rank[outcomeSeverity]) {
      outcomeSeverity = sev;
      outcomeRaw = s.outcome;
    }
  }

  const seenFindings = new Set<string>();
  const failFindings: IntakeScanFinding[] = [];
  const otherFindings: IntakeScanFinding[] = [];
  for (const s of sources) {
    for (const f of s.findings) {
      const key = f.text.toLowerCase();
      if (seenFindings.has(key)) continue;
      seenFindings.add(key);
      const entry = { ...f, id: `agg:${f.id}:${seenFindings.size}` };
      if (f.status === "fail") failFindings.push(entry);
      else otherFindings.push(entry);
    }
  }
  const primaryIssue = failFindings[0]?.text ?? null;

  const seenActions = new Set<string>();
  const actions: IntakeScanAction[] = [];
  for (const s of sources) {
    for (const a of s.actions) {
      const key = a.text.toLowerCase();
      if (seenActions.has(key)) continue;
      seenActions.add(key);
      actions.push({
        ...a,
        id: `agg:${a.id}:${seenActions.size}`,
        // Corrective deadline from the document applies to undated actions
        // only when the document outcome is critical.
        deadline:
          a.deadline ??
          (outcomeSeverity === "critical" ? actionDeadline : null),
      });
      if (actions.length >= 8) break;
    }
    if (actions.length >= 8) break;
  }

  // Renewal reminders are consequential too — offer them as confirmable rows.
  const renewal = dates.find((d) => d.kind === "expiry" || d.kind === "next_due");
  if (renewal && actions.length < 8) {
    actions.push({
      id: `remind:${renewal.date}`,
      text: `Set reminder — ${renewal.label} ${formatIntakeDateDisplay(renewal.date)}`,
      deadline: renewal.date,
      immediate: false,
      kind: "reminder",
      selectedByDefault: true,
    });
  }

  const signals: string[] = [];
  if (outcomeSeverity === "critical" && outcomeRaw) {
    signals.push(`Outcome: ${outcomeRaw.replace(/_/g, " ")}`);
  }
  for (const s of sources) {
    for (const label of s.alertLabels) {
      if (signals.length >= 6) break;
      if (!signals.includes(label)) signals.push(label);
    }
  }

  return {
    outcome: displayOutcome(outcomeRaw),
    outcomeSeverity,
    primaryIssue,
    dates,
    actionDeadline,
    actions,
    failFindings,
    otherFindings,
    signals,
    fileCountWithScan: sources.length,
  };
}

export function primaryExpiryFromScanReview(review: AggregatedIntakeScanReview): string | null {
  return primaryExpiryFromDates(review.dates);
}
