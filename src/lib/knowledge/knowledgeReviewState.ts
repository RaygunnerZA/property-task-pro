/**
 * Review-workbench state: canonical guidance, blockers, primary actions, filters.
 */

import type { KnowledgeRow } from "@/types/knowledge";
import {
  needsGuidanceGeneration,
  resolveImportedDraftGuidance,
} from "@/lib/knowledge/knowledgeDraftGuidance";
import {
  assessGuidanceQuality,
  isGuidanceMissing,
  isMeaningfulGuidanceProse,
  needsGuidanceImprovement,
  type GuidanceQualityState,
} from "@/lib/knowledge/knowledgeGuidanceQuality";
import {
  attrString,
  buildTrustChecks,
  computeSourceHealth,
  isMeaningfulGuidanceText,
  parseApplicability,
  parseCriticSummary,
  type KnowledgeSourcePreview,
  type TrustCheck,
  type TrustCheckId,
  type TrustCheckStatus,
} from "@/lib/knowledge/knowledgePresentation";

export type ReviewQueueId = "needs_work" | "awaiting_critic" | "ready_to_verify";

export type ReviewFilterId =
  | "guidance_missing"
  | "guidance_needs_improvement"
  | "guidance_meaningful"
  | "classification_missing"
  | "source_missing"
  | "applicability_incomplete"
  | "critic_not_run"
  | "critic_stale"
  | "critic_failed"
  | "ready_for_human";

export type ReviewSortId = "fewest_blockers" | "newest" | "jurisdiction";

export type PrimaryActionKind =
  | "generate"
  | "improve"
  | "resolve"
  | "run_critic"
  | "review"
  | "verify"
  | "view";

export type CompactBlocker = {
  id: TrustCheckId;
  shortName: string;
};

export type ReviewToolbarCounts = {
  needsWork: number;
  awaitingCritic: number;
  readyForVerification: number;
  missingGuidance: number;
  needingImprovement: number;
  meaningfulDraft: number;
};

const PLACEHOLDER_JURISDICTIONS = /^(all|any|global|worldwide|n\/?a|unknown)$/i;

export function hasCanonicalGuidance(
  row: Pick<
    KnowledgeRow,
    | "summary"
    | "body"
    | "title"
    | "attributes"
    | "applicability"
    | "status"
    | "reviewed_by"
    | "provenance"
  >
): boolean {
  return isMeaningfulGuidanceProse(row);
}

/** Guidance column: summary/body only — never invent from action for display. */
export function displayCanonicalGuidance(
  row: Pick<KnowledgeRow, "summary" | "body">
): string {
  if (isMeaningfulGuidanceText(row.summary)) return row.summary!.trim();
  if (isMeaningfulGuidanceText(row.body)) return row.body!.trim();
  if (row.summary?.trim()) return row.summary.trim();
  if (row.body?.trim()) return row.body.trim();
  return "No guidance written yet.";
}

export function guidanceQualityLabel(
  row: Pick<
    KnowledgeRow,
    | "summary"
    | "body"
    | "title"
    | "attributes"
    | "applicability"
    | "status"
    | "reviewed_by"
    | "provenance"
  >
): string {
  const state = assessGuidanceQuality(row).state;
  if (state === "missing") return "Missing";
  if (state === "needs_improvement") return "Needs work";
  if (state === "verified") return "Draft ready";
  return "Draft ready";
}

/** Single provenance chip for the table (not stacked with quality). */
export function guidanceProvenanceChip(
  row: Pick<KnowledgeRow, "provenance">
): string | null {
  const draft = (row.provenance as Record<string, unknown> | null)?.guidance_draft;
  if (!draft || typeof draft !== "object") return null;
  const d = draft as Record<string, unknown>;
  if (d.unverified !== true) return null;
  const source = typeof d.source === "string" ? d.source : "";
  if (source === "ai") return "AI proposal";
  if (source === "human_edit") return "Edited draft";
  if (source.startsWith("imported")) return "Imported draft";
  return "Edited draft";
}

export function hasDeterministicGuidanceFields(
  row: Pick<KnowledgeRow, "attributes">
): boolean {
  const attrs = (row.attributes ?? {}) as Record<string, string>;
  return !resolveImportedDraftGuidance({
    summary: null,
    body: null,
    attributes: attrs,
  }).isEmpty;
}

/** Enough structured context for Generate/Improve (source preferred, not required). */
export function hasGuidanceGenerationContext(
  row: KnowledgeRow,
  sources: KnowledgeSourcePreview[]
): boolean {
  if (computeSourceHealth(sources, row).authoritative.length > 0) return true;
  if (hasDeterministicGuidanceFields(row)) return true;
  if (hasClassificationSet(row)) return true;
  if (
    attrString(row.attributes, "action") ||
    attrString(row.attributes, "applies_when") ||
    attrString(row.attributes, "guidance") ||
    attrString(row.attributes, "task")
  ) {
    return true;
  }
  return Boolean(row.title?.trim());
}

export function isEligibleForGuidanceGeneration(
  row: KnowledgeRow,
  sources: KnowledgeSourcePreview[]
): boolean {
  if (row.status !== "candidate") return false;
  if (!isGuidanceMissing(row)) return false;
  return hasGuidanceGenerationContext(row, sources);
}

export function isEligibleForGuidanceImprovement(
  row: KnowledgeRow,
  sources: KnowledgeSourcePreview[]
): boolean {
  if (row.status !== "candidate") return false;
  if (!needsGuidanceImprovement(row)) return false;
  return hasGuidanceGenerationContext(row, sources);
}

/** Prefer deterministic fill; AI only when still empty after that. */
export function prefersDeterministicGuidance(row: KnowledgeRow): boolean {
  return isGuidanceMissing(row) && hasDeterministicGuidanceFields(row);
}

export function normalizeJurisdictionLabels(
  jurisdictions: string[]
): { labels: string[]; missing: boolean; rawHadPlaceholder: boolean } {
  const cleaned = jurisdictions
    .map((j) => j.trim())
    .filter(Boolean)
    .filter((j) => !PLACEHOLDER_JURISDICTIONS.test(j));
  const rawHadPlaceholder = jurisdictions.some((j) =>
    PLACEHOLDER_JURISDICTIONS.test(j.trim())
  );
  if (cleaned.length === 0) {
    return {
      labels: [],
      missing: true,
      rawHadPlaceholder: rawHadPlaceholder || jurisdictions.length === 0,
    };
  }
  return { labels: cleaned, missing: false, rawHadPlaceholder };
}

export function displayJurisdiction(row: KnowledgeRow): string {
  const app = parseApplicability(row.applicability);
  if (app.unscoped) return "Global";
  const { labels, missing } = normalizeJurisdictionLabels(app.jurisdictions);
  if (missing) return "Jurisdiction missing";
  return labels.join(" · ");
}

export function hasClassificationSet(row: KnowledgeRow): boolean {
  const legal =
    attrString(row.attributes, "legal_status") ||
    attrString(row.attributes, "classification") ||
    "";
  if (!legal.trim()) return false;
  if (/not set|unknown|n\/?a/i.test(legal)) return false;
  return true;
}

export function hasTriggerSet(row: KnowledgeRow): boolean {
  const explicit =
    attrString(row.attributes, "trigger_type") ||
    attrString(row.attributes, "event_trigger") ||
    "";
  if (explicit.trim()) return true;
  const when =
    attrString(row.attributes, "applies_when") ||
    attrString(row.attributes, "timing") ||
    attrString(row.attributes, "frequency") ||
    "";
  return Boolean(when.trim());
}

export function deriveTriggerType(
  row: Pick<KnowledgeRow, "attributes">
): "event_driven" | "scheduled" | "continuous" | "threshold_based" | null {
  const explicit = (
    attrString(row.attributes, "trigger_type") ||
    attrString(row.attributes, "event_trigger") ||
    ""
  ).toLowerCase();
  if (/event/.test(explicit)) return "event_driven";
  if (/schedule|recurring/.test(explicit)) return "scheduled";
  if (/continuous|ongoing/.test(explicit)) return "continuous";
  if (/threshold/.test(explicit)) return "threshold_based";

  const when =
    `${attrString(row.attributes, "applies_when") || ""} ${attrString(row.attributes, "timing") || ""} ${attrString(row.attributes, "frequency") || ""}`.trim();
  if (/before|prior|pre-work|consent|notice|when (planning|starting)|work planned|present/i.test(when)) {
    return "event_driven";
  }
  if (/threshold|exceed|above|below|limit|CO2|tonne/i.test(when)) {
    return "threshold_based";
  }
  if (/annual|yearly|monthly|quarter|every\s+\d|recurring|schedule|interval/i.test(when)) {
    return "scheduled";
  }
  if (/ongoing|continuous|always|at all times|maintain|replace by/i.test(when)) {
    return "continuous";
  }
  if (attrString(row.attributes, "frequency")) return "scheduled";
  if (when) return "event_driven";
  return null;
}

export function deriveClassificationLabel(
  row: Pick<KnowledgeRow, "attributes">
): string | null {
  const legal =
    attrString(row.attributes, "legal_status") ||
    attrString(row.attributes, "classification") ||
    "";
  if (!legal.trim()) return null;
  if (/mandatory|required|statutory|obligation/i.test(legal)) {
    return "Mandatory requirement";
  }
  if (/contract|insurance/i.test(legal)) {
    return "Contractual or insurance requirement";
  }
  if (/recommend|good practice|advisory|prevent/i.test(legal)) {
    return "Preventative good practice";
  }
  if (/legal/i.test(legal)) return legal.trim();
  return legal.trim();
}

export function buildReviewTrustChecks(
  row: KnowledgeRow,
  opts?: {
    sources?: KnowledgeSourcePreview[];
    verificationEvents?: Array<{
      event_type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>;
  }
): TrustCheck[] {
  return buildTrustChecks(row, opts);
}

const VERIFY_BLOCKING_IDS: Array<TrustCheck["id"]> = [
  "guidance",
  "source_authority",
  "source_freshness",
  "applicability",
  "classification",
  "trigger",
  "contradiction",
];

const DISPLAY_BLOCKING_IDS: Array<TrustCheck["id"]> = [
  ...VERIFY_BLOCKING_IDS,
  "human",
];

function isBlockingStatus(status: TrustCheckStatus): boolean {
  return (
    status === "failed" ||
    status === "incomplete" ||
    status === "not_run" ||
    status === "required"
  );
}

/** Automated gates that must clear before human verify. */
export function reviewAutomatedBlockingChecks(checks: TrustCheck[]): TrustCheck[] {
  return checks.filter(
    (c) => VERIFY_BLOCKING_IDS.includes(c.id) && isBlockingStatus(c.status)
  );
}

/** Blockers shown in the workbench (includes human by lifecycle stage). */
export function reviewBlockingChecks(
  checks: TrustCheck[],
  _status?: KnowledgeRow["status"]
): TrustCheck[] {
  return checks.filter(
    (c) => DISPLAY_BLOCKING_IDS.includes(c.id) && isBlockingStatus(c.status)
  );
}

const SHORT_NAMES: Record<string, string> = {
  guidance: "Guidance",
  source_authority: "Source",
  source_freshness: "Freshness",
  applicability: "Applicability",
  classification: "Classification",
  trigger: "Trigger",
  contradiction: "Critic",
  human: "Human",
};

export function compactBlockers(
  checks: TrustCheck[],
  status?: KnowledgeRow["status"]
): CompactBlocker[] {
  return reviewBlockingChecks(checks, status).map((c) => ({
    id: c.id,
    shortName: SHORT_NAMES[c.id] || c.label,
  }));
}

export function automatedCheckCompletion(checks: TrustCheck[]): {
  done: number;
  total: number;
  label: string;
} {
  const auto = checks.filter((c) => c.id !== "human");
  const done = auto.filter((c) => c.status === "passed").length;
  return {
    done,
    total: auto.length,
    label: `${done}/${auto.length} automated`,
  };
}

export function matchesReviewFilter(
  filter: ReviewFilterId,
  row: KnowledgeRow,
  checks: TrustCheck[],
  sources: KnowledgeSourcePreview[]
): boolean {
  const critic = parseCriticSummary(row, undefined, { sources });
  const quality = assessGuidanceQuality(row);
  switch (filter) {
    case "guidance_missing":
      return quality.state === "missing";
    case "guidance_needs_improvement":
      return quality.state === "needs_improvement";
    case "guidance_meaningful":
      return quality.state === "meaningful_draft" || quality.state === "verified";
    case "classification_missing":
      return !hasClassificationSet(row);
    case "source_missing":
      return computeSourceHealth(sources, row).authoritative.length === 0;
    case "applicability_incomplete":
      return reviewAutomatedBlockingChecks(checks).some(
        (b) => b.id === "applicability"
      );
    case "critic_not_run":
      return critic.status === "not_run";
    case "critic_stale":
      return critic.status === "stale";
    case "critic_failed":
      return critic.status === "failed";
    case "ready_for_human":
      return isReadyForHumanVerify(row, checks);
    default:
      return true;
  }
}

export function isReadyForHumanVerify(
  row: KnowledgeRow,
  checks: TrustCheck[]
): boolean {
  if (row.status !== "candidate") return false;
  return reviewAutomatedBlockingChecks(checks).length === 0;
}

export function isCriticAwaiting(
  row: KnowledgeRow,
  checks: TrustCheck[],
  sources: KnowledgeSourcePreview[]
): boolean {
  if (row.status !== "candidate") return false;
  if (!hasCanonicalGuidance(row)) return false;
  const critic = parseCriticSummary(row, undefined, { sources });
  const autoBlockers = reviewAutomatedBlockingChecks(checks).filter(
    (b) => b.id !== "contradiction"
  );
  if (autoBlockers.length > 0) return false;
  return critic.status === "not_run" || critic.status === "stale";
}

export function primaryActionForRow(
  row: KnowledgeRow,
  checks: TrustCheck[],
  sources: KnowledgeSourcePreview[]
): { kind: PrimaryActionKind; label: string } {
  if (row.status === "verified") {
    const autoBlockers = reviewAutomatedBlockingChecks(checks);
    if (autoBlockers.length > 0) {
      return { kind: "review", label: "Review" };
    }
    return { kind: "view", label: "View" };
  }

  // Missing or short/weak guidance always takes priority over Resolve / critic.
  if (isGuidanceMissing(row)) {
    return { kind: "generate", label: "Generate" };
  }
  if (needsGuidanceImprovement(row)) {
    return { kind: "improve", label: "Improve" };
  }

  const autoBlockers = reviewAutomatedBlockingChecks(checks);
  const critic = parseCriticSummary(row, undefined, { sources });

  if (autoBlockers.length === 0) {
    return { kind: "verify", label: "Verify" };
  }

  if (critic.status === "failed") {
    return { kind: "review", label: "Review findings" };
  }

  if (critic.status === "not_run" || critic.status === "stale") {
    const nonCritic = autoBlockers.filter((b) => b.id !== "contradiction");
    if (nonCritic.length === 0) {
      return { kind: "run_critic", label: "Run critic" };
    }
    return { kind: "resolve", label: "Resolve" };
  }

  return { kind: "resolve", label: "Resolve" };
}

export function isNeedsWorkRow(
  row: KnowledgeRow,
  checks: TrustCheck[],
  sources: KnowledgeSourcePreview[]
): boolean {
  if (row.status !== "candidate" && row.status !== "verified") return false;
  if (isReadyForHumanVerify(row, checks)) return false;
  if (isCriticAwaiting(row, checks, sources)) return false;
  const critic = parseCriticSummary(row, undefined, { sources });
  const quality = assessGuidanceQuality(row);
  if (quality.state === "missing" || quality.state === "needs_improvement") return true;
  if (!hasClassificationSet(row)) return true;
  if (computeSourceHealth(sources, row).authoritative.length === 0) return true;
  if (reviewAutomatedBlockingChecks(checks).some((b) => b.id === "applicability")) {
    return true;
  }
  if (critic.status === "failed") return true;
  // Other incomplete automated gates
  return reviewAutomatedBlockingChecks(checks).some((b) => b.id !== "contradiction");
}

export function matchesReviewQueue(
  queue: ReviewQueueId,
  row: KnowledgeRow,
  checks: TrustCheck[],
  sources: KnowledgeSourcePreview[]
): boolean {
  switch (queue) {
    case "needs_work":
      return isNeedsWorkRow(row, checks, sources);
    case "awaiting_critic":
      return isCriticAwaiting(row, checks, sources);
    case "ready_to_verify":
      return isReadyForHumanVerify(row, checks);
    default:
      return true;
  }
}

export function computeReviewToolbarCounts(
  rows: KnowledgeRow[],
  sourcesByKnowledge: Map<string, KnowledgeSourcePreview[]>
): ReviewToolbarCounts {
  let needsWork = 0;
  let awaitingCritic = 0;
  let readyForVerification = 0;
  let missingGuidance = 0;
  let needingImprovement = 0;
  let meaningfulDraft = 0;

  for (const row of rows) {
    if (row.status !== "candidate" && row.status !== "verified") continue;
    const sources = sourcesByKnowledge.get(row.id) ?? [];
    const checks = buildReviewTrustChecks(row, { sources });
    const quality = assessGuidanceQuality(row);
    if (row.status === "candidate") {
      if (quality.state === "missing") missingGuidance += 1;
      if (quality.state === "needs_improvement") needingImprovement += 1;
      if (quality.state === "meaningful_draft") meaningfulDraft += 1;
    }
    if (isReadyForHumanVerify(row, checks)) readyForVerification += 1;
    else if (isCriticAwaiting(row, checks, sources)) awaitingCritic += 1;
    else if (isNeedsWorkRow(row, checks, sources)) needsWork += 1;
  }

  return {
    needsWork,
    awaitingCritic,
    readyForVerification,
    missingGuidance,
    needingImprovement,
    meaningfulDraft,
  };
}

export function sortReviewRows(
  rows: Array<{
    row: KnowledgeRow;
    blockerCount: number;
    jurisdiction: string;
  }>,
  sort: ReviewSortId
): typeof rows {
  const copy = [...rows];
  if (sort === "fewest_blockers") {
    copy.sort((a, b) => {
      if (a.blockerCount !== b.blockerCount) return a.blockerCount - b.blockerCount;
      return b.row.created_at.localeCompare(a.row.created_at);
    });
  } else if (sort === "newest") {
    copy.sort((a, b) => b.row.created_at.localeCompare(a.row.created_at));
  } else {
    copy.sort((a, b) =>
      a.jurisdiction.localeCompare(b.jurisdiction, undefined, {
        sensitivity: "base",
      })
    );
  }
  return copy;
}

export type { GuidanceQualityState };

// re-export for callers that still use needsGuidanceGeneration name
export { needsGuidanceGeneration, needsGuidanceImprovement, isGuidanceMissing };
