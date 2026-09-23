/**
 * Composed Review card — the answer, what Filla found, and one decision.
 *
 * Presents existing Knowledge data (guidance, claims, sources, checks) as a
 * reviewer-facing card: plain-language answer first, machinery behind Evidence.
 * Pure composition — no new gates. Approve still routes through the fail-closed
 * `admin_set_knowledge_status` server checks (@Docs/29 Judgement gates).
 */

import type { KnowledgeRow } from "@/types/knowledge";
import { summarizeKnowledgeClaims } from "@/lib/knowledge/knowledgeClaims";
import {
  attrString,
  canPublish,
  canVerify,
  computeSourceHealth,
  displayKnowledgeGuidance,
  displayKnowledgeTitle,
  formatApplicabilityLine,
  isGuidanceDraft,
  isMeaningfulGuidanceText,
  parseApplicability,
  type KnowledgeSourcePreview,
  type TrustCheck,
} from "@/lib/knowledge/knowledgePresentation";
import {
  inferKnowledgeFieldsFromClaims,
  type ClaimLike,
  type RequirementGroup,
} from "@/lib/knowledge/knowledgeFieldInference";

export type ReviewCardFact = { label: string; value: string };

export type ReviewCardDecision = {
  kind: "approve" | "correct" | "hold";
  label: string;
  enabled: boolean;
  /** For approve: the status Approve would set (verify first, then publish). */
  targetStatus?: "verified" | "published";
  /** Why the action is disabled (honest, specific). */
  disabledReason?: string;
};

export type ReviewCardModel = {
  displayTitle: string;
  /** Plain-language answer (guidance text; may be an unverified draft). */
  answer: string;
  answerIsDraft: boolean;
  jurisdictionLine: string;
  facts: ReviewCardFact[];
  groups: RequirementGroup[];
  found: {
    supportedActions: number;
    unresolvedClaims: number;
    localVariations: number;
    authoritativeSources: number;
    relatedItems: number;
  };
  /** "Filla found six related requirements and recommendations from one authoritative source." */
  foundLine: string;
  /** Why this row needs human attention (constitution interrupt conditions). */
  interrupts: string[];
  decisions: ReviewCardDecision[];
};

const LOCAL_VARIATION_PATTERN =
  /local|municipal|canton|d[ée]partement|prefect|copropri[ée]t[ée]|by-?law|arr[êe]t[ée]/i;

function factsFromInference(
  row: KnowledgeRow,
  inferred: ReturnType<typeof inferKnowledgeFieldsFromClaims>
): ReviewCardFact[] {
  const facts: ReviewCardFact[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value && isMeaningfulGuidanceText(value)) facts.push({ label, value });
  };
  push(
    "Applies when",
    inferred.applies_when || attrString(row.attributes, "applies_when")
  );
  push(
    "Timing",
    inferred.timing ||
      attrString(row.attributes, "timing") ||
      attrString(row.attributes, "frequency")
  );
  push("Evidence", inferred.evidence || attrString(row.attributes, "evidence"));
  return facts;
}

function countLocalVariations(
  row: KnowledgeRow,
  claims: Array<{ claim_text?: string; category?: string }>
): number {
  let count = 0;
  for (const claim of claims) {
    const text = String(claim.claim_text ?? "");
    if (claim.category === "exception" || LOCAL_VARIATION_PATTERN.test(text)) count += 1;
  }
  if (count === 0) {
    const blob = `${row.summary ?? ""}\n${row.body ?? ""}`;
    if (LOCAL_VARIATION_PATTERN.test(blob)) count = 1;
  }
  return count;
}

/**
 * Interrupt conditions per the product standard — only these justify pulling
 * a human in. Everything else is presentation, not an alarm.
 */
export function reviewInterrupts(input: {
  row: KnowledgeRow;
  claims: Array<{ verification_status?: string; category?: string }>;
  checks: TrustCheck[];
  authoritativeSourceCount: number;
}): string[] {
  const interrupts: string[] = [];
  const app = parseApplicability(input.row.applicability);

  if (!app.unscoped && app.jurisdictions.length === 0) {
    interrupts.push("Jurisdiction is unclear — set applicability before this can be trusted.");
  }
  const summary = summarizeKnowledgeClaims(input.claims);
  if (summary.unknown + summary.unresolved > 0) {
    interrupts.push(
      `${summary.unknown + summary.unresolved} claim(s) are only partially supported by the sources.`
    );
  }
  if (input.authoritativeSourceCount === 0) {
    interrupts.push("No authoritative source is linked yet — obligations cannot be verified.");
  }
  const failedCheck = input.checks.find((c) => c.status === "failed");
  if (failedCheck) {
    interrupts.push(`Check failed: ${failedCheck.label}.`);
  }
  if (input.row.status === "verified") {
    interrupts.push("Machine recommends publishing — human confirmation required.");
  }
  return interrupts;
}

export function buildReviewCard(input: {
  row: KnowledgeRow;
  claims: Array<{
    claim_text?: string;
    category?: string;
    verification_status?: string;
    applicability?: Record<string, unknown> | null;
    critic_result?: Record<string, unknown> | null;
  }>;
  sources: KnowledgeSourcePreview[];
  checks: TrustCheck[];
}): ReviewCardModel {
  const { row, claims, sources, checks } = input;
  const app = parseApplicability(row.applicability);
  const health = computeSourceHealth(sources, row);
  const claimSummary = summarizeKnowledgeClaims(claims);
  const sourceUrl = sources.find((s) => typeof s.url === "string" && s.url)?.url ?? null;
  const sourceTitle = sources.find((s) => s.label)?.label ?? null;
  const inferred = inferKnowledgeFieldsFromClaims({
    claims: claims as ClaimLike[],
    attributes: row.attributes as Record<string, unknown>,
    title: row.title,
    summary: row.summary,
    jurisdiction: app.jurisdictions[0] ?? null,
    sourceUrl,
    sourceTitle,
  });

  const supportedActions = claimSummary.verified + claimSummary.extracted;
  const unresolvedClaims = claimSummary.unknown + claimSummary.unresolved;
  const localVariations = countLocalVariations(row, claims);
  const authoritativeSources = health.authoritative.length;
  const relatedItems = inferred.foundCount;

  const interrupts = reviewInterrupts({
    row,
    claims,
    checks,
    authoritativeSourceCount: authoritativeSources,
  });

  const setLabel = relatedItems > 1;
  let approve: ReviewCardDecision;
  if (row.status === "candidate") {
    const eligible = canVerify(row, checks);
    approve = {
      kind: "approve",
      label: setLabel ? "Approve Knowledge set" : "Approve",
      enabled: eligible,
      targetStatus: "verified",
      disabledReason: eligible
        ? undefined
        : "Blocked by checks — open Evidence to see which check is failing.",
    };
  } else if (row.status === "stale") {
    approve = {
      kind: "approve",
      label: setLabel ? "Approve Knowledge set" : "Approve",
      enabled: false,
      disabledReason:
        "Marked stale — re-check the sources (Correct) before it can be approved again.",
    };
  } else if (row.status === "verified") {
    const eligible = canPublish(row, checks);
    approve = {
      kind: "approve",
      label: "Approve & publish",
      enabled: eligible,
      targetStatus: "published",
      disabledReason: eligible
        ? undefined
        : "Publish gate not satisfied — open Evidence to see what is missing.",
    };
  } else {
    approve = {
      kind: "approve",
      label: "Approved",
      enabled: false,
      disabledReason:
        row.status === "published"
          ? "Already published."
          : `No approval available from status “${row.status}”.`,
    };
  }

  const composed =
    inferred.composedAnswer && isMeaningfulGuidanceText(inferred.composedAnswer)
      ? inferred.composedAnswer
      : displayKnowledgeGuidance(row);

  return {
    displayTitle: displayKnowledgeTitle(row, {
      claims: claims as ClaimLike[],
      sourceUrl,
      sourceTitle,
    }),
    answer: composed,
    answerIsDraft: isGuidanceDraft(row),
    jurisdictionLine: formatApplicabilityLine(app) || "Applicability not set",
    facts: factsFromInference(row, inferred),
    groups: inferred.groups,
    found: {
      supportedActions,
      unresolvedClaims,
      localVariations,
      authoritativeSources,
      relatedItems,
    },
    foundLine: inferred.foundLine(authoritativeSources),
    interrupts,
    decisions: [
      approve,
      {
        kind: "correct",
        label: "Correct",
        enabled: true,
      },
      {
        kind: "hold",
        label: "Hold",
        enabled: row.status !== "published",
        disabledReason:
          row.status === "published" ? "Published Knowledge is managed via updates." : undefined,
      },
    ],
  };
}
