import type { ContentOutputKind, ContentOutputRow } from "@/types/knowledge";

/** Explicit topic workflow statuses (sequential content production). */
export const CONTENT_TOPIC_WORKFLOW_STATUSES = [
  "generating_seo",
  "seo_review",
  "generating_brief",
  "brief_review",
  "ready_for_outputs",
  "generating_outputs",
  "output_review",
  "visual_concept_review",
  "generating_final_assets",
  "ready_for_publishing",
  "generation_failed",
] as const;

export type ContentTopicWorkflowStatus = (typeof CONTENT_TOPIC_WORKFLOW_STATUSES)[number];

export type ContentWorkflowStep = "knowledge" | "seo" | "brief" | "outputs" | "creative";

export type ContentStageApprovalStatus = "none" | "pending" | "approved" | "rejected";

export type ContentGenerationProvenance = {
  model?: string;
  prompt_version?: string;
  knowledge_version?: number;
  generated_at?: string;
  /** Strategy id only, e.g. "model:gemini-2.0-flash". Never a Strategy object. */
  strategy?: string;
  strategy_id?: string;
  source_coverage_summary?: string;
  source_content_unavailable?: boolean;
};

export type SeoProposal = {
  primary_search_theme: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  user_problem: string;
  jurisdiction: string;
  content_angle: string;
  source_coverage_summary: string;
  evidence_gaps: string[];
  research_warnings: string[];
  source_content_unavailable: boolean;
};

export type SeoReadinessStatus =
  | "blocked"
  | "source_retrieval_required"
  | "verification_required"
  | "ready_for_approval"
  | "approved";

export type SeoReadiness = {
  status: SeoReadinessStatus;
  label: string;
  sourceUnavailable: boolean;
  sourceIssues: string[];
  knowledgeGaps: string[];
  verificationRequirements: string[];
  canApprove: boolean;
};

export const SEO_READINESS_LABELS: Record<SeoReadinessStatus, string> = {
  blocked: "Blocked",
  source_retrieval_required: "Source retrieval required",
  verification_required: "Verification required",
  ready_for_approval: "Ready for approval",
  approved: "Approved",
};

const AUDIENCE_CHIP_LABELS: Record<string, string> = {
  owner: "Property owners & landlords",
  manager: "Property managers",
  field: "Field staff",
  tenant: "Tenants",
  public: "Public",
};

/** Short labels for SEO metadata chips (structured values unchanged). */
const AUDIENCE_SHORT_LABELS: Record<string, string> = {
  owner: "Owners",
  manager: "Property managers",
  field: "Field staff",
  tenant: "Tenants",
  public: "Public",
  landlord: "Landlords",
  landlords: "Landlords",
  owners: "Owners",
};

/** Accept a strategy id string, or `{ id }` from runCapability. Never call string methods on objects. */
export function asStrategyId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

/** Editorial/AI text: strings only. Objects are dropped, not stringified. */
export function asEditorialText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) out.push(trimmed);
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        const extracted = asEditorialText(rec.label ?? rec.text ?? rec.value ?? rec.title);
        if (extracted) out.push(extracted);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function asBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}

export function normalizeSeoProposal(raw: unknown): SeoProposal {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    primary_search_theme: asEditorialText(obj.primary_search_theme),
    primary_keyword: asEditorialText(obj.primary_keyword),
    secondary_keywords: asStringList(obj.secondary_keywords),
    search_intent: asEditorialText(obj.search_intent),
    target_audience: asEditorialText(obj.target_audience),
    user_problem: asEditorialText(obj.user_problem),
    jurisdiction: asEditorialText(obj.jurisdiction),
    content_angle: asEditorialText(obj.content_angle),
    source_coverage_summary: asEditorialText(obj.source_coverage_summary),
    evidence_gaps: asStringList(obj.evidence_gaps),
    research_warnings: asStringList(obj.research_warnings),
    source_content_unavailable: asBooleanFlag(obj.source_content_unavailable),
  };
}

export function normalizeProvenance(raw: unknown): ContentGenerationProvenance {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const strategyId = asStrategyId(obj.strategy_id ?? obj.strategy);
  return {
    model: asEditorialText(obj.model) || undefined,
    prompt_version: asEditorialText(obj.prompt_version) || undefined,
    knowledge_version: typeof obj.knowledge_version === "number" ? obj.knowledge_version : undefined,
    generated_at: asEditorialText(obj.generated_at) || undefined,
    strategy: strategyId ?? undefined,
    strategy_id: strategyId ?? undefined,
    source_coverage_summary: asEditorialText(obj.source_coverage_summary) || undefined,
    source_content_unavailable: asBooleanFlag(obj.source_content_unavailable) || undefined,
  };
}

export function getSeoReadiness(seo: ContentStageEnvelope): SeoReadiness {
  const proposal = normalizeSeoProposal(seo.current ?? seo.approved ?? {});
  const latestProvenance = normalizeProvenance(
    seo.versions && seo.versions.length > 0
      ? seo.versions[seo.versions.length - 1]?.provenance
      : undefined
  );
  const sourceUnavailable =
    proposal.source_content_unavailable || Boolean(latestProvenance.source_content_unavailable);
  const partitioned = partitionSeoGrounding(proposal);
  const knowledgeGaps = partitioned.knowledgeGaps;
  const verificationRequirements = partitioned.verificationChecks;
  const sourceIssues = partitioned.sourceIssues;
  const hasProposal = Boolean(proposal.primary_keyword || proposal.primary_search_theme);

  let status: SeoReadinessStatus;
  if (seo.approval_status === "approved") {
    status = "approved";
  } else if (!hasProposal) {
    status = "blocked";
  } else if (sourceUnavailable || sourceIssues.length > 0) {
    status = "source_retrieval_required";
  } else if (knowledgeGaps.length > 0 || verificationRequirements.length > 0) {
    status = "verification_required";
  } else {
    status = "ready_for_approval";
  }

  return {
    status,
    label: SEO_READINESS_LABELS[status],
    sourceUnavailable,
    sourceIssues,
    knowledgeGaps,
    verificationRequirements,
    canApprove: status === "ready_for_approval",
  };
}

export function canApproveSeo(seo: ContentStageEnvelope): boolean {
  return getSeoReadiness(seo).canApprove;
}

export function audienceChipLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return AUDIENCE_CHIP_LABELS[key] ?? raw.trim();
}

export function audienceShortLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return AUDIENCE_SHORT_LABELS[key] ?? audienceChipLabel(raw);
}

export function inheritedAudienceShortLabels(
  applicability: Record<string, unknown> | undefined
): string[] {
  const audiences = Array.isArray(applicability?.audiences)
    ? (applicability?.audiences as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  return audiences.map((a) => audienceShortLabel(a));
}

/** Compact chip text, e.g. Owners · Landlords · Property managers · Tenants */
export function formatAudienceChipDisplay(
  audience: string,
  applicability: Record<string, unknown> | undefined
): string {
  if (applicability && isInheritedAudience(audience, applicability)) {
    const labels = inheritedAudienceShortLabels(applicability);
    if (labels.length > 0) return labels.join(" · ");
  }
  const tokens = audience
    .split(/\s*(?:,|;|\||\/|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length > 1) {
    return tokens.map((t) => audienceShortLabel(t)).join(" · ");
  }
  return audienceShortLabel(audience);
}

const SOURCE_ACCESS_PATTERN =
  /source.*unavailable|unavailable.*source|could not be retrieved|retrieval failed|full source text|content unavailable|unable to retrieve|source access|source text from|couldn't be retrieved/i;

export function isSourceAccessFinding(text: string): boolean {
  return SOURCE_ACCESS_PATTERN.test(text.trim());
}

export function partitionSeoGrounding(proposal: SeoProposal): {
  sourceIssues: string[];
  knowledgeGaps: string[];
  verificationChecks: string[];
} {
  const sourceIssues: string[] = [];
  const knowledgeGaps: string[] = [];

  for (const item of proposal.evidence_gaps) {
    if (isSourceAccessFinding(item)) sourceIssues.push(item);
    else knowledgeGaps.push(item);
  }

  if (proposal.source_content_unavailable) {
    const summary = proposal.source_coverage_summary.trim();
    const generic = "Linked source content unavailable";
    if (summary && isSourceAccessFinding(summary)) {
      if (!sourceIssues.includes(summary)) sourceIssues.unshift(summary);
    } else if (!sourceIssues.some((s) => isSourceAccessFinding(s))) {
      sourceIssues.unshift(generic);
    }
  }

  return {
    sourceIssues,
    knowledgeGaps,
    verificationChecks: proposal.research_warnings,
  };
}

export function formatGroundedSummary(input: {
  sourceCount: number;
  checkedAt?: string | null;
}): string {
  const count = Math.max(0, input.sourceCount);
  const checked = input.checkedAt
    ? new Date(input.checkedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
  return `Grounded · ${count} source${count === 1 ? "" : "s"} · checked ${checked}`;
}

export function inheritedAudienceLabels(applicability: Record<string, unknown> | undefined): string[] {
  const audiences = Array.isArray(applicability?.audiences)
    ? (applicability?.audiences as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  return audiences.map(audienceChipLabel);
}

export function inheritedJurisdictionLabels(applicability: Record<string, unknown> | undefined): string[] {
  if (!applicability) return [];
  const jurisdictions = Array.isArray(applicability.jurisdictions)
    ? (applicability.jurisdictions as unknown[]).filter((j): j is string => typeof j === "string")
    : [];
  if (jurisdictions.length > 0) return jurisdictions;
  if (applicability.unscoped) return ["Global (unscoped)"];
  return [];
}

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
}

export function isInheritedJurisdiction(
  seoJurisdiction: string,
  applicability: Record<string, unknown> | undefined
): boolean {
  const value = normKey(seoJurisdiction);
  if (!value) return false;
  return inheritedJurisdictionLabels(applicability).some((j) => normKey(j) === value);
}

export function isInheritedAudience(
  seoAudience: string,
  applicability: Record<string, unknown> | undefined
): boolean {
  const value = normKey(seoAudience);
  if (!value) return false;
  return inheritedAudienceLabels(applicability).some((a) => {
    const label = normKey(a);
    return label === value || label.includes(value) || value.includes(label);
  });
}

export type ContentStageVersion = {
  id: string;
  created_at: string;
  status: "draft" | "approved" | "rejected";
  provenance: ContentGenerationProvenance;
  payload: Record<string, unknown>;
};

export type ContentStageEnvelope = {
  approval_status?: ContentStageApprovalStatus;
  stale?: boolean;
  current?: Record<string, unknown>;
  approved?: Record<string, unknown> | null;
  versions?: ContentStageVersion[];
  last_error?: string;
  rejection_reason?: string;
};

export const OUTPUT_KIND_OPTIONS: { id: ContentOutputKind; label: string; description: string }[] = [
  { id: "core_article", label: "Core article", description: "Long-form blog or help article" },
  { id: "faq", label: "FAQ", description: "Question-and-answer block" },
  { id: "in_app_tip", label: "In-app tip", description: "Short Living Knowledge tip" },
  { id: "newsletter", label: "Newsletter", description: "Email newsletter segment" },
  { id: "social_post", label: "Social post", description: "Short social caption" },
  { id: "reel_script", label: "Reel script", description: "Short-form video script" },
];

export const WORKFLOW_STATUS_LABELS: Record<ContentTopicWorkflowStatus, string> = {
  generating_seo: "Generating SEO",
  seo_review: "SEO review",
  generating_brief: "Generating brief",
  brief_review: "Brief review",
  ready_for_outputs: "Ready for outputs",
  generating_outputs: "Generating outputs",
  output_review: "Output review",
  visual_concept_review: "Visual concept review",
  generating_final_assets: "Generating final assets",
  ready_for_publishing: "Ready for publishing",
  generation_failed: "Generation failed",
};

const STEP_ORDER: ContentWorkflowStep[] = ["knowledge", "seo", "brief", "outputs", "creative"];

export function normalizeStageEnvelope(raw: unknown): ContentStageEnvelope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { approval_status: "none", stale: false, current: {}, versions: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("approval_status" in obj || "current" in obj || "versions" in obj) {
    return {
      approval_status: (obj.approval_status as ContentStageApprovalStatus) ?? "none",
      stale: Boolean(obj.stale),
      current: (obj.current as Record<string, unknown>) ?? {},
      approved: (obj.approved as Record<string, unknown> | null) ?? null,
      versions: Array.isArray(obj.versions) ? (obj.versions as ContentStageVersion[]) : [],
      last_error: typeof obj.last_error === "string" ? obj.last_error : undefined,
      rejection_reason: typeof obj.rejection_reason === "string" ? obj.rejection_reason : undefined,
    };
  }
  return {
    approval_status: Object.keys(obj).length > 0 ? "pending" : "none",
    stale: false,
    current: obj,
    approved: null,
    versions: [],
  };
}

export function getWorkflowStep(status: ContentTopicWorkflowStatus): ContentWorkflowStep {
  switch (status) {
    case "generating_seo":
    case "seo_review":
    case "generation_failed":
      return "seo";
    case "generating_brief":
    case "brief_review":
      return "brief";
    case "ready_for_outputs":
    case "generating_outputs":
    case "output_review":
      return "outputs";
    case "visual_concept_review":
    case "generating_final_assets":
    case "ready_for_publishing":
      return "creative";
    default:
      return "seo";
  }
}

export function stepIndex(step: ContentWorkflowStep): number {
  return STEP_ORDER.indexOf(step);
}

export function isStepComplete(
  step: ContentWorkflowStep,
  workflowStatus: ContentTopicWorkflowStatus,
  seo: ContentStageEnvelope,
  brief: ContentStageEnvelope
): boolean {
  const current = stepIndex(getWorkflowStep(workflowStatus));
  const target = stepIndex(step);
  if (target < current) return true;
  if (step === "knowledge") return true;
  if (step === "seo") return seo.approval_status === "approved";
  if (step === "brief") return brief.approval_status === "approved";
  if (step === "outputs") {
    return workflowStatus === "visual_concept_review" ||
      workflowStatus === "generating_final_assets" ||
      workflowStatus === "ready_for_publishing";
  }
  return workflowStatus === "ready_for_publishing";
}

export function isSeoApproved(seo: ContentStageEnvelope): boolean {
  return seo.approval_status === "approved";
}

export function isBriefApproved(brief: ContentStageEnvelope): boolean {
  return brief.approval_status === "approved";
}

export function canGenerateBrief(
  workflowStatus: ContentTopicWorkflowStatus,
  seo: ContentStageEnvelope
): boolean {
  return isSeoApproved(seo) &&
    (workflowStatus === "brief_review" || workflowStatus === "generation_failed");
}

export function canGenerateOutputs(
  workflowStatus: ContentTopicWorkflowStatus,
  brief: ContentStageEnvelope
): boolean {
  return isBriefApproved(brief) &&
    ["ready_for_outputs", "output_review", "generation_failed"].includes(workflowStatus);
}

export function canGenerateCreative(brief: ContentStageEnvelope): boolean {
  return isBriefApproved(brief);
}

export function hasSeoProposal(seo: ContentStageEnvelope): boolean {
  const proposal = normalizeSeoProposal(seo.current ?? {});
  return Boolean(proposal.primary_keyword || proposal.primary_search_theme);
}

export function hasBriefProposal(brief: ContentStageEnvelope): boolean {
  const c = brief.current ?? {};
  return Boolean(asEditorialText(c.working_title ?? c.title));
}

/** Legacy topic create seeded empty draft rows — not real downstream outputs. */
export function isPlaceholderOutput(row: ContentOutputRow): boolean {
  const hasContent = Boolean(asEditorialText(row.title) || asEditorialText(row.body));
  return !hasContent && row.status === "draft";
}

/** Outputs are inaccessible until the brief gate is passed. */
export function getAccessibleOutputs(
  outputs: ContentOutputRow[],
  briefApproved: boolean
): ContentOutputRow[] {
  if (!briefApproved) return [];
  return outputs.filter((row) => !isPlaceholderOutput(row));
}

export function summarizeOutputsStage(
  outputs: ContentOutputRow[],
  briefApproved: boolean
): string {
  if (!briefApproved) return "Locked until brief approved";
  const accessible = getAccessibleOutputs(outputs, true);
  if (accessible.length === 0) return "No outputs yet";
  const generated = accessible.filter((row) => Boolean(asEditorialText(row.body)));
  if (generated.length === 0) {
    return `${accessible.length} slot${accessible.length === 1 ? "" : "s"} ready`;
  }
  return `${generated.length} output${generated.length === 1 ? "" : "s"}`;
}

export function isStageActivelyGenerating(
  workflowStatus: ContentTopicWorkflowStatus,
  seo: ContentStageEnvelope,
  brief: ContentStageEnvelope
): boolean {
  if (workflowStatus === "generating_seo") {
    return !hasSeoProposal(seo) && !seo.last_error;
  }
  if (workflowStatus === "generating_brief") {
    return !hasBriefProposal(brief) && !brief.last_error;
  }
  return (
    workflowStatus === "generating_outputs" || workflowStatus === "generating_final_assets"
  );
}

/** When generation finished but workflow_status was not reset, treat as review. */
export function resolveEffectiveWorkflowStatus(
  workflowStatus: ContentTopicWorkflowStatus,
  seo: ContentStageEnvelope,
  brief: ContentStageEnvelope,
  activelyGenerating: boolean
): ContentTopicWorkflowStatus {
  if (activelyGenerating) return workflowStatus;
  if (workflowStatus === "generating_seo" && hasSeoProposal(seo)) return "seo_review";
  if (workflowStatus === "generating_brief" && hasBriefProposal(brief)) return "brief_review";
  return workflowStatus;
}

export function getWorkflowStatusDisplay(input: {
  workflowStatus: ContentTopicWorkflowStatus;
  seo: ContentStageEnvelope;
  brief: ContentStageEnvelope;
  activelyGenerating: boolean;
}): { label: string; detail: string | null } {
  const effective = resolveEffectiveWorkflowStatus(
    input.workflowStatus,
    input.seo,
    input.brief,
    input.activelyGenerating
  );

  if (effective === "seo_review" && hasSeoProposal(input.seo) && !isSeoApproved(input.seo)) {
    const readiness = getSeoReadiness(input.seo);
    return {
      label: WORKFLOW_STATUS_LABELS.seo_review,
      detail: readiness.label,
    };
  }

  return {
    label: WORKFLOW_STATUS_LABELS[effective] ?? effective,
    detail: null,
  };
}

export type GroundingRemedyId =
  | "retrieve_source"
  | "add_source"
  | "research_evidence"
  | "return_knowledge";

export type GroundingRemedy = {
  id: GroundingRemedyId;
  label: string;
  description: string;
  available: boolean;
};

export function getGroundingRemedies(readiness: SeoReadiness): {
  headline: string;
  explanation: string;
  remedies: GroundingRemedy[];
} {
  if (readiness.status === "source_retrieval_required") {
    return {
      headline: "Source content could not be retrieved",
      explanation:
        "The SEO proposal was built from Knowledge metadata, but the underlying source text was unavailable. Approval is blocked until grounding is restored.",
      remedies: [
        {
          id: "retrieve_source",
          label: "Retrieve original source",
          description: "Re-run SEO generation after confirming linked Knowledge sources are reachable.",
          available: true,
        },
        {
          id: "add_source",
          label: "Add or replace source",
          description: "Attach or update the Knowledge source document this topic derives from.",
          available: true,
        },
        {
          id: "return_knowledge",
          label: "Open Knowledge",
          description: "Review verified Knowledge and its linked sources before continuing SEO.",
          available: true,
        },
        {
          id: "research_evidence",
          label: "Research missing evidence",
          description:
            "Build one grounded evidence pack on the linked Knowledge row, then run critic. You still verify claims before Approve SEO.",
          available: true,
        },
      ],
    };
  }

  if (readiness.status === "verification_required") {
    const gapCount = readiness.knowledgeGaps.length;
    const checkCount = readiness.verificationRequirements.length;
    return {
      headline: "Grounding checks remain",
      explanation: `Resolve ${gapCount} knowledge gap${gapCount === 1 ? "" : "s"} and ${checkCount} verification check${checkCount === 1 ? "" : "s"} before SEO can be approved.`,
      remedies: [
        {
          id: "research_evidence",
          label: "Research missing evidence",
          description:
            "Fetch sources, propose claims on the linked Knowledge row, and run critic. Never auto-verifies or auto-approves SEO.",
          available: true,
        },
        {
          id: "return_knowledge",
          label: "Open Knowledge",
          description: "Open the Knowledge stage to review claims and tap Verify claims.",
          available: true,
        },
        {
          id: "retrieve_source",
          label: "Regenerate from sources",
          description: "Re-run SEO generation after upstream Knowledge or sources change.",
          available: true,
        },
        {
          id: "add_source",
          label: "Add supporting source",
          description: "Attach additional evidence to the linked Knowledge item.",
          available: true,
        },
      ],
    };
  }

  return {
    headline: "Grounding incomplete",
    explanation: "Resolve grounding issues before approving SEO.",
    remedies: [],
  };
}

export type PrimaryAction =
  | { kind: "generate_seo"; label: string }
  | { kind: "approve_seo"; label: string }
  | { kind: "resolve_grounding"; label: string }
  | { kind: "generate_brief"; label: string }
  | { kind: "approve_brief"; label: string }
  | { kind: "select_outputs"; label: string }
  | { kind: "generate_creative"; label: string }
  | { kind: "retry"; label: string }
  | { kind: "none"; label: string };

export function getPrimaryAction(input: {
  workflowStatus: ContentTopicWorkflowStatus;
  seo: ContentStageEnvelope;
  brief: ContentStageEnvelope;
  outputs: ContentOutputRow[];
}): PrimaryAction {
  const { workflowStatus, seo, brief, outputs } = input;

  if (workflowStatus === "generation_failed") {
    const step = getWorkflowStep(workflowStatus);
    if (step === "seo" || !isSeoApproved(seo)) {
      return { kind: "retry", label: "Retry SEO generation" };
    }
    if (step === "brief" || !isBriefApproved(brief)) {
      return { kind: "retry", label: "Retry brief generation" };
    }
    return { kind: "retry", label: "Retry generation" };
  }

  if (isStageActivelyGenerating(workflowStatus, seo, brief)) {
    return { kind: "none", label: "Generating…" };
  }

  if (!hasSeoProposal(seo)) {
    return { kind: "generate_seo", label: "Generate SEO opportunity" };
  }

  const effectiveStatus = resolveEffectiveWorkflowStatus(workflowStatus, seo, brief, false);
  const seoReviewing = effectiveStatus === "seo_review" && seo.approval_status !== "approved";
  if (seoReviewing) {
    const readiness = getSeoReadiness(seo);
    if (readiness.canApprove) {
      return { kind: "approve_seo", label: "Approve SEO" };
    }
    return { kind: "resolve_grounding", label: "Resolve grounding" };
  }

  if (isSeoApproved(seo) && !hasBriefProposal(brief)) {
    return { kind: "generate_brief", label: "Generate editorial brief" };
  }

  const effectiveBriefStatus = resolveEffectiveWorkflowStatus(workflowStatus, seo, brief, false);
  if (effectiveBriefStatus === "brief_review" && brief.approval_status !== "approved") {
    return { kind: "approve_brief", label: "Approve brief" };
  }

  if (isBriefApproved(brief) && getAccessibleOutputs(outputs, true).length === 0) {
    return { kind: "select_outputs", label: "Choose outputs to generate" };
  }

  if (isBriefApproved(brief) && workflowStatus === "ready_for_outputs") {
    return { kind: "select_outputs", label: "Generate outputs" };
  }

  if (isBriefApproved(brief) && workflowStatus === "output_review") {
    return { kind: "generate_creative", label: "Create visual concept" };
  }

  if (workflowStatus === "visual_concept_review") {
    return { kind: "generate_creative", label: "Review visual concept" };
  }

  return { kind: "none", label: "Continue review" };
}

export function appendStageVersion(
  envelope: ContentStageEnvelope,
  payload: Record<string, unknown>,
  provenance: ContentGenerationProvenance
): ContentStageEnvelope {
  const version: ContentStageVersion = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: "draft",
    provenance,
    payload,
  };
  const previous = envelope.current ?? {};
  const current: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(previous)) {
    if (!key.startsWith("research_")) continue;
    if (!(key in current)) current[key] = value;
  }
  if (current.research_status === "running") {
    current.research_status = "idle";
  }
  return {
    ...envelope,
    approval_status: "pending",
    current,
    versions: [...(envelope.versions ?? []), version],
    last_error: undefined,
  };
}

export function jurisdictionLabel(applicability: Record<string, unknown> | undefined): string {
  if (!applicability) return "—";
  const jurisdictions = Array.isArray(applicability.jurisdictions)
    ? (applicability.jurisdictions as string[])
    : [];
  if (jurisdictions.length > 0) return jurisdictions.join(", ");
  if (applicability.unscoped) return "Global (unscoped)";
  return "—";
}

export function seoSummary(seo: ContentStageEnvelope): string {
  const proposal = normalizeSeoProposal(seo.approved ?? seo.current ?? {});
  const keyword = proposal.primary_keyword || proposal.primary_search_theme;
  const intent = proposal.search_intent;
  if (!keyword) return "No SEO proposal yet";
  const prefix = seo.approval_status === "approved" ? "Approved · " : "";
  return prefix + (intent ? `${keyword} · ${intent}` : keyword);
}

export function briefSummary(brief: ContentStageEnvelope): string {
  const c = brief.approved ?? brief.current ?? {};
  const title = asEditorialText(c.working_title ?? c.title);
  const angle = asEditorialText(c.content_angle ?? c.angle);
  if (!title) return "No brief yet";
  const prefix = brief.approval_status === "approved" ? "Approved · " : "";
  return prefix + (angle ? `${title} — ${angle}` : title);
}
