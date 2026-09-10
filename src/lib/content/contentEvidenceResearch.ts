/**
 * Content Tree evidence research: classify blockers, map gaps, fingerprint auto-kick.
 * Pack persistence lives in the edge function + orchestration hook.
 */

import type { SeoReadiness } from "@/lib/content/contentTopicWorkflow";
import { normalizeSeoProposal, partitionSeoGrounding } from "@/lib/content/contentTopicWorkflow";
import { MAX_RESEARCH_GAPS } from "@/lib/knowledge/knowledgeCoverage";

/** Matches edge `ResearchGapInput` for knowledge-gap-research discovery. */
export type ContentResearchGapInput = {
  id: string;
  topic_key: string;
  topic: string;
  jurisdiction: string;
  status: "missing" | "partial";
};

export type EvidenceBlockerClass = "retrieve" | "verify_only" | "research_pack" | "ready";

export type EvidenceResearchStatus =
  | "idle"
  | "running"
  | "awaiting_human"
  | "verify_only"
  | "human_verified"
  | "failed";

export type ContentEvidenceResearchMeta = {
  research_status?: EvidenceResearchStatus;
  research_fingerprint?: string;
  research_started_at?: string;
  research_finished_at?: string;
  research_last_error?: string | null;
  research_remaining_gaps?: string[];
  research_attached_urls?: string[];
};

export type ClassifyEvidenceInput = {
  readiness: SeoReadiness;
  /** Claims already on the linked Knowledge row. */
  claims?: Array<{
    claim_text?: string | null;
    verification_status?: string | null;
  }>;
  /** Linked Knowledge already has at least one http(s) source URL. */
  hasUsableSourceUrl: boolean;
};

/**
 * Decide the cheapest next action before spending model tokens.
 * - retrieve: source text missing — fix/regenerate, do not pack yet
 * - verify_only: extracted claims exist; human verify is the stop
 * - research_pack: need grounded collect on linked Knowledge
 * - ready: SEO can be approved
 */
export function classifyEvidenceBlocker(input: ClassifyEvidenceInput): EvidenceBlockerClass {
  const { readiness } = input;
  if (readiness.canApprove || readiness.status === "approved") return "ready";
  if (readiness.status === "blocked") return "retrieve";

  if (readiness.status === "source_retrieval_required" || readiness.sourceUnavailable) {
    // If we already have a URL, pack can re-fetch; otherwise retrieve/add-source first.
    if (input.hasUsableSourceUrl) return "research_pack";
    return "retrieve";
  }

  if (readiness.status === "verification_required") {
    const unverified = (input.claims ?? []).filter((c) => {
      const status = String(c.verification_status ?? "").toLowerCase();
      return status === "extracted" || status === "unresolved";
    });
    const hasKnowledgeGaps = readiness.knowledgeGaps.length > 0;
    // Claims waiting on human and no new factual gaps → verify only.
    if (unverified.length > 0 && !hasKnowledgeGaps) return "verify_only";
    // Gaps listed but only unverified duplicates of claim text → verify only.
    if (unverified.length > 0 && hasKnowledgeGaps) {
      const claimTexts = new Set(
        unverified.map((c) => normalizeGapText(c.claim_text ?? "")).filter(Boolean)
      );
      const allGapsAreExistingClaims = readiness.knowledgeGaps.every((g) =>
        claimTexts.has(normalizeGapText(g))
      );
      if (allGapsAreExistingClaims) return "verify_only";
    }
    return "research_pack";
  }

  return "research_pack";
}

export function normalizeGapText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildEvidenceResearchFingerprint(input: {
  topicId: string;
  knowledgeId: string;
  knowledgeGaps: string[];
  sourceUnavailable: boolean;
}): string {
  const gaps = input.knowledgeGaps.map(normalizeGapText).filter(Boolean).sort();
  return [
    input.topicId,
    input.knowledgeId,
    input.sourceUnavailable ? "1" : "0",
    gaps.join("|"),
  ].join("::");
}

export function shouldAutoKickEvidenceResearch(input: {
  fingerprint: string;
  meta: ContentEvidenceResearchMeta | null | undefined;
}): boolean {
  const meta = input.meta ?? {};
  // Human already completed the verify stop — do not bounce back into research/Knowledge.
  if (meta.research_status === "human_verified") return false;
  if (meta.research_status === "running") return false;
  if (
    meta.research_status === "awaiting_human" &&
    meta.research_fingerprint === input.fingerprint
  ) {
    return false;
  }
  if (
    meta.research_status === "verify_only" &&
    meta.research_fingerprint === input.fingerprint
  ) {
    return false;
  }
  if (
    meta.research_status === "failed" &&
    meta.research_fingerprint === input.fingerprint
  ) {
    // Allow manual retry; auto-kick skips identical failed fingerprint once.
    return false;
  }
  return true;
}

export function mapKnowledgeGapsToResearchInputs(input: {
  topicId: string;
  knowledgeTitle: string;
  jurisdiction: string;
  knowledgeGaps: string[];
}): ContentResearchGapInput[] {
  const jurisdiction = input.jurisdiction.trim() || "unscoped";
  const topic = input.knowledgeTitle.trim() || "Knowledge topic";
  const gaps = input.knowledgeGaps.map((g) => g.trim()).filter(Boolean);
  const out: ContentResearchGapInput[] = [];
  for (let i = 0; i < gaps.length && out.length < MAX_RESEARCH_GAPS; i++) {
    const text = gaps[i]!;
    out.push({
      id: `content:${input.topicId}:${i}`,
      topic_key: `content_${input.topicId.slice(0, 8)}`,
      topic: `${topic} — ${text}`.slice(0, 200),
      jurisdiction,
      status: "partial",
    });
  }
  return out;
}

export function readResearchMetaFromSeoCurrent(
  current: Record<string, unknown> | null | undefined
): ContentEvidenceResearchMeta {
  if (!current || typeof current !== "object") return {};
  const status = current.research_status;
  return {
    research_status:
      status === "idle" ||
      status === "running" ||
      status === "awaiting_human" ||
      status === "verify_only" ||
      status === "human_verified" ||
      status === "failed"
        ? status
        : undefined,
    research_fingerprint:
      typeof current.research_fingerprint === "string"
        ? current.research_fingerprint
        : undefined,
    research_started_at:
      typeof current.research_started_at === "string"
        ? current.research_started_at
        : undefined,
    research_finished_at:
      typeof current.research_finished_at === "string"
        ? current.research_finished_at
        : undefined,
    research_last_error:
      typeof current.research_last_error === "string"
        ? current.research_last_error
        : current.research_last_error === null
          ? null
          : undefined,
    research_remaining_gaps: Array.isArray(current.research_remaining_gaps)
      ? current.research_remaining_gaps.filter((g): g is string => typeof g === "string")
      : undefined,
    research_attached_urls: Array.isArray(current.research_attached_urls)
      ? current.research_attached_urls.filter((u): u is string => typeof u === "string")
      : undefined,
  };
}

export function jurisdictionFromApplicability(
  applicability: Record<string, unknown> | null | undefined
): string {
  if (!applicability) return "unscoped";
  const jurisdictions = applicability.jurisdictions;
  if (Array.isArray(jurisdictions)) {
    const first = jurisdictions.find((j) => typeof j === "string" && j.trim());
    if (typeof first === "string") return first.trim();
  }
  if (applicability.unscoped === true) return "unscoped";
  return "unscoped";
}

/** Merge research progress fields into SEO `current` without dropping proposal fields. */
export function mergeResearchMetaIntoSeoCurrent(
  current: Record<string, unknown> | null | undefined,
  meta: ContentEvidenceResearchMeta
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    ...meta,
  };
}

export type EvidenceResearchPhase =
  | "idle"
  | "classifying"
  | "packing"
  | "critic"
  | "awaiting_human"
  | "verify_only"
  | "retrieve"
  | "failed";

/** After human claim verify: keep source blockers, drop soft claim-gap strings so Approve SEO is reachable. */
export function applyHumanVerifiedSeoClearance(
  current: Record<string, unknown> | null | undefined,
  meta?: Partial<ContentEvidenceResearchMeta>
): Record<string, unknown> {
  const proposal = normalizeSeoProposal(current ?? {});
  const { sourceIssues } = partitionSeoGrounding(proposal);
  return mergeResearchMetaIntoSeoCurrent(
    {
      ...(current ?? {}),
      ...proposal,
      evidence_gaps: sourceIssues,
      research_warnings: [],
      source_content_unavailable: sourceIssues.length > 0 ? proposal.source_content_unavailable : false,
    },
    {
      research_status: "human_verified",
      research_finished_at: new Date().toISOString(),
      research_last_error: null,
      research_remaining_gaps: [],
      ...meta,
    }
  );
}

export function researchProgressCopy(input: {
  phase?: EvidenceResearchPhase | null;
  meta?: ContentEvidenceResearchMeta | null;
}): string | null {
  const phase = input.phase ?? "idle";
  const meta = input.meta ?? {};
  const status = meta.research_status;

  if (phase === "classifying") return "Checking what evidence is missing…";
  if (phase === "packing") return "Building evidence pack from sources…";
  if (phase === "critic") return "Critic reviewing proposed claims…";
  if (phase === "retrieve") {
    return "Add or retrieve a reachable source URL, then research again";
  }
  if (phase === "awaiting_human" || status === "awaiting_human") {
    return "Verify claims, then Approve SEO on this panel";
  }
  if (phase === "verify_only" || status === "verify_only") {
    return "Verify claims, then Approve SEO on this panel";
  }
  if (status === "human_verified") {
    return "Claims verified — Approve SEO when the proposal looks right";
  }
  if (phase === "failed" || status === "failed") {
    return meta.research_last_error
      ? `Research failed: ${meta.research_last_error}`
      : "Research failed — retry or fix sources";
  }
  if (status === "running") return "Building evidence pack from sources…";
  return null;
}
