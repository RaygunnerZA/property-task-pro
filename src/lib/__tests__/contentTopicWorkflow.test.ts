import { describe, expect, it } from "vitest";
import {
  asEditorialText,
  asStrategyId,
  canApproveSeo,
  canGenerateBrief,
  canGenerateOutputs,
  getPrimaryAction,
  getSeoReadiness,
  getWorkflowStatusDisplay,
  getWorkflowStep,
  getAccessibleOutputs,
  isSourceAccessFinding,
  partitionSeoGrounding,
  formatAudienceChipDisplay,
  summarizeOutputsStage,
  hasSeoProposal,
  isBriefApproved,
  isSeoApproved,
  isStepComplete,
  normalizeProvenance,
  normalizeSeoProposal,
  normalizeStageEnvelope,
  seoSummary,
} from "@/lib/content/contentTopicWorkflow";

describe("contentTopicWorkflow", () => {
  const emptySeo = normalizeStageEnvelope({});
  const pendingSeo = normalizeStageEnvelope({
    approval_status: "pending",
    current: { primary_keyword: "smoke alarm rules" },
  });
  const approvedSeo = normalizeStageEnvelope({
    approval_status: "approved",
    current: { primary_keyword: "smoke alarm rules" },
    approved: { primary_keyword: "smoke alarm rules" },
  });
  const emptyBrief = normalizeStageEnvelope({});
  const pendingBrief = normalizeStageEnvelope({
    approval_status: "pending",
    current: { working_title: "Smoke alarms at home" },
  });
  const approvedBrief = normalizeStageEnvelope({
    approval_status: "approved",
    current: { working_title: "Smoke alarms at home" },
    approved: { working_title: "Smoke alarms at home" },
  });

  it("maps workflow status to step", () => {
    expect(getWorkflowStep("seo_review")).toBe("seo");
    expect(getWorkflowStep("brief_review")).toBe("brief");
    expect(getWorkflowStep("ready_for_outputs")).toBe("outputs");
    expect(getWorkflowStep("visual_concept_review")).toBe("creative");
  });

  it("blocks brief until SEO approval", () => {
    expect(canGenerateBrief("brief_review", pendingSeo)).toBe(false);
    expect(canGenerateBrief("brief_review", approvedSeo)).toBe(true);
  });

  it("blocks outputs until brief approval", () => {
    expect(canGenerateOutputs("ready_for_outputs", emptyBrief)).toBe(false);
    expect(canGenerateOutputs("ready_for_outputs", approvedBrief)).toBe(true);
  });

  it("offers Generate SEO when no proposal exists", () => {
    const action = getPrimaryAction({
      workflowStatus: "seo_review",
      seo: emptySeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("generate_seo");
    expect(action.label).toBe("Generate SEO opportunity");
  });

  it("offers Approve SEO when proposal exists but not approved", () => {
    expect(hasSeoProposal(pendingSeo)).toBe(true);
    expect(isSeoApproved(pendingSeo)).toBe(false);
    const action = getPrimaryAction({
      workflowStatus: "seo_review",
      seo: pendingSeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("approve_seo");
  });

  it("offers Generate brief after SEO approval", () => {
    const action = getPrimaryAction({
      workflowStatus: "brief_review",
      seo: approvedSeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("generate_brief");
  });

  it("marks SEO step complete only after approval", () => {
    expect(isStepComplete("seo", "seo_review", pendingSeo, emptyBrief)).toBe(false);
    expect(isStepComplete("seo", "brief_review", approvedSeo, emptyBrief)).toBe(true);
  });

  it("marks brief step complete only after approval", () => {
    expect(isStepComplete("brief", "brief_review", approvedSeo, pendingBrief)).toBe(false);
    expect(isStepComplete("brief", "ready_for_outputs", approvedSeo, approvedBrief)).toBe(true);
  });

  it("normalizes legacy flat seo blobs", () => {
    const env = normalizeStageEnvelope({
      primary_keyword: "test",
      search_intent: "informational",
    });
    expect(env.approval_status).toBe("pending");
    expect(env.current?.primary_keyword).toBe("test");
  });

  it("preserves version arrays in envelope normalization", () => {
    const env = normalizeStageEnvelope({
      approval_status: "pending",
      current: { primary_keyword: "a" },
      versions: [{ id: "v1", created_at: "2026-01-01", status: "draft", provenance: {}, payload: {} }],
    });
    expect(env.versions).toHaveLength(1);
  });
});

describe("SEO strategy metadata guards", () => {
  const strategyObject = {
    id: "model:gemini-2.0-flash",
    kind: "model",
    provider: "GEMINI",
    model: "gemini-3.6-flash",
  };

  it("extracts a strategy id from a runCapability Strategy object", () => {
    expect(asStrategyId(strategyObject)).toBe("model:gemini-2.0-flash");
    expect(asStrategyId("model:gpt-4o-mini")).toBe("model:gpt-4o-mini");
    expect(asStrategyId(null)).toBeNull();
    expect(asStrategyId({ model: "gemini" })).toBeNull();
  });

  it("does not crash or stringify when strategy is an object", () => {
    const provenance = normalizeProvenance({
      strategy: strategyObject,
      model: "gemini-3.6-flash",
    });
    expect(provenance.strategy).toBe("model:gemini-2.0-flash");
    expect(provenance.strategy_id).toBe("model:gemini-2.0-flash");
    expect(provenance.strategy?.replace("model:", "")).toBe("gemini-2.0-flash");
  });

  it("drops object-shaped SEO fields instead of stringifying them", () => {
    const proposal = normalizeSeoProposal({
      primary_keyword: "smoke alarm installation France",
      primary_search_theme: { title: "not a string" },
      search_intent: { type: "informational" },
      strategy: strategyObject,
      evidence_gaps: [
        "Detailed legal/regulatory basis",
        { label: "Penalties or consequences for non-compliance" },
        { nested: true },
      ],
      source_content_unavailable: "true",
    });
    expect(proposal.primary_search_theme).toBe("");
    expect(proposal.search_intent).toBe("");
    expect(proposal.primary_keyword).toBe("smoke alarm installation France");
    expect(proposal.evidence_gaps).toEqual([
      "Detailed legal/regulatory basis",
      "Penalties or consequences for non-compliance",
    ]);
    expect(proposal.source_content_unavailable).toBe(true);
    expect(asEditorialText(strategyObject)).toBe("");
    expect(JSON.stringify(proposal)).not.toContain("[object Object]");
  });
});

describe("SEO readiness and approval gating", () => {
  const emptyBrief = normalizeStageEnvelope({});

  const groundedSeo = normalizeStageEnvelope({
    approval_status: "pending",
    current: {
      primary_keyword: "smoke alarm installation France",
      primary_search_theme: "Smoke Alarm Compliance in France",
      search_intent: "Informational",
      source_content_unavailable: false,
      evidence_gaps: [],
      research_warnings: [],
    },
  });

  const sourceMissingSeo = normalizeStageEnvelope({
    approval_status: "pending",
    current: {
      primary_keyword: "smoke alarm installation France",
      source_content_unavailable: true,
      evidence_gaps: [
        "Detailed legal/regulatory basis",
        "Full source text from service-public.fr is unavailable",
      ],
      research_warnings: ["Verify current smoke alarm regulations"],
    },
  });

  const gapsOnlySeo = normalizeStageEnvelope({
    approval_status: "pending",
    current: {
      primary_keyword: "smoke alarm installation France",
      source_content_unavailable: false,
      evidence_gaps: ["Definition of a compliant smoke alarm"],
      research_warnings: [],
    },
  });

  const provenanceUnavailableSeo = normalizeStageEnvelope({
    approval_status: "pending",
    current: { primary_keyword: "smoke alarm installation France" },
    versions: [
      {
        id: "v1",
        created_at: "2026-09-03",
        status: "draft",
        provenance: { source_content_unavailable: true },
        payload: {},
      },
    ],
  });

  it("marks a clean proposal ready for approval", () => {
    const readiness = getSeoReadiness(groundedSeo);
    expect(readiness.status).toBe("ready_for_approval");
    expect(readiness.canApprove).toBe(true);
    expect(canApproveSeo(groundedSeo)).toBe(true);
  });

  it("requires source retrieval when source content is unavailable", () => {
    const readiness = getSeoReadiness(sourceMissingSeo);
    expect(readiness.status).toBe("source_retrieval_required");
    expect(readiness.canApprove).toBe(false);
    expect(readiness.knowledgeGaps).toEqual(["Detailed legal/regulatory basis"]);
    expect(readiness.verificationRequirements).toHaveLength(1);
    expect(readiness.sourceIssues.some((s) => /unavailable/i.test(s))).toBe(true);
  });

  it("partitions source-access findings away from knowledge gaps", () => {
    const partitioned = partitionSeoGrounding(
      normalizeSeoProposal({
        source_content_unavailable: true,
        evidence_gaps: [
          "Exact technical standard for detector placement",
          "Full source text from service-public.fr is unavailable",
        ],
        research_warnings: ["Confirm current law applies to this property type"],
      })
    );
    expect(partitioned.knowledgeGaps).toEqual(["Exact technical standard for detector placement"]);
    expect(partitioned.sourceIssues.some((s) => /service-public/i.test(s))).toBe(true);
    expect(isSourceAccessFinding("Full source text from service-public.fr is unavailable")).toBe(true);
  });

  it("formats audience chips in compact form", () => {
    expect(
      formatAudienceChipDisplay("owner", {
        audiences: ["owner", "manager", "tenant"],
      })
    ).toBe("Owners · Property managers · Tenants");
  });

  it("requires verification when knowledge gaps remain", () => {
    const readiness = getSeoReadiness(gapsOnlySeo);
    expect(readiness.status).toBe("verification_required");
    expect(readiness.canApprove).toBe(false);
  });

  it("reads source-unavailable from provenance when the payload omitted it", () => {
    expect(getSeoReadiness(provenanceUnavailableSeo).status).toBe("source_retrieval_required");
  });

  it("does not offer ordinary Approve SEO when grounding is incomplete", () => {
    const action = getPrimaryAction({
      workflowStatus: "seo_review",
      seo: sourceMissingSeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("resolve_grounding");
    expect(action.label).toBe("Resolve grounding");
  });

  it("does not offer ordinary Approve SEO when verification is required", () => {
    const action = getPrimaryAction({
      workflowStatus: "seo_review",
      seo: gapsOnlySeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("resolve_grounding");
  });

  it("does not stay stuck on Generating when a last_error exists", () => {
    const stuck = normalizeStageEnvelope({
      approval_status: "pending",
      last_error: "run.strategy?.replace is not a function",
      current: {
        primary_keyword: "smoke alarm installation France",
        source_content_unavailable: true,
      },
    });
    const action = getPrimaryAction({
      workflowStatus: "generating_seo",
      seo: stuck,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("resolve_grounding");
  });

  it("offers Approve SEO only when the proposal is grounded", () => {
    const action = getPrimaryAction({
      workflowStatus: "seo_review",
      seo: groundedSeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).toBe("approve_seo");
  });

  it("does not show Generating when SEO proposal exists but status stuck on generating_seo", () => {
    const action = getPrimaryAction({
      workflowStatus: "generating_seo",
      seo: groundedSeo,
      brief: emptyBrief,
      outputs: [],
    });
    expect(action.kind).not.toBe("none");
    expect(action.label).not.toBe("Generating…");
  });

  it("shows SEO review detail when proposal exists during seo_review", () => {
    const display = getWorkflowStatusDisplay({
      workflowStatus: "seo_review",
      seo: sourceMissingSeo,
      brief: emptyBrief,
      activelyGenerating: false,
    });
    expect(display.label).toBe("SEO review");
    expect(display.detail).toBe("Source retrieval required");
  });

  it("hides legacy placeholder outputs until brief is approved", () => {
    const placeholders = [
      {
        id: "1",
        topic_id: "t",
        output_kind: "core_article" as const,
        status: "draft" as const,
        title: null,
        body: null,
        structured: {},
        provenance: {},
        version: 1,
        approved_by: null,
        approved_at: null,
        created_at: "",
        updated_at: "",
      },
    ];
    expect(summarizeOutputsStage(placeholders, false)).toBe("Locked until brief approved");
    expect(getAccessibleOutputs(placeholders, false)).toHaveLength(0);
  });

  it("summarizes outputs stage without counting empty placeholders", () => {
    const placeholders = [
      {
        id: "1",
        topic_id: "t",
        output_kind: "core_article" as const,
        status: "draft" as const,
        title: null,
        body: null,
        structured: {},
        provenance: {},
        version: 1,
        approved_by: null,
        approved_at: null,
        created_at: "",
        updated_at: "",
      },
    ];
    expect(summarizeOutputsStage(placeholders, true)).toBe("No outputs yet");
  });

  it("summarizes an approved stage without exposing raw objects", () => {
    const approved = normalizeStageEnvelope({
      approval_status: "approved",
      current: {
        primary_keyword: { bad: true },
        primary_search_theme: "Smoke Alarm Compliance in France",
        search_intent: "Informational",
      },
      approved: {
        primary_keyword: "smoke alarm installation France",
        search_intent: "Informational",
      },
    });
    expect(seoSummary(approved)).toBe("Approved · smoke alarm installation France · Informational");
    expect(isStepComplete("seo", "brief_review", approved, emptyBrief)).toBe(true);
  });
});
