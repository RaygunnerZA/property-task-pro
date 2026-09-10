import {
  useAdminApproveContentTopicBrief,
  useAdminContentTopic,
  useAdminContentTopics,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminKnowledgeDetail,
  useAdminKnowledgeQueue,
  useAdminRejectContentTopicBrief,
  useAdminSetContentOutputStatus,
  useAdminSetKnowledgeStatus,
  useAdminUpsertContentOutput,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { useContentEvidenceResearch } from "@/hooks/admin/useContentEvidenceResearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContentQueueOvernightButton } from "@/components/admin/ContentQueueOvernightButton";
import { SeoStage } from "@/components/admin/AdminContentSeoStage";
import { AdminContentEvidenceDrawer } from "@/components/admin/AdminContentEvidenceDrawer";
import { KnowledgeSourceUrlEditor } from "@/components/admin/KnowledgeSourceUrlEditor";
import { KnowledgeClaimsList } from "@/components/admin/KnowledgeClaimsList";
import { cn } from "@/lib/utils";
import {
  OUTPUT_KIND_OPTIONS,
  getAccessibleOutputs,
  getPrimaryAction,
  getSeoReadiness,
  getWorkflowStatusDisplay,
  getWorkflowStep,
  briefSummary,
  canGenerateOutputs,
  hasSeoProposal,
  isBriefApproved,
  isSeoApproved,
  isStageActivelyGenerating,
  isStepComplete,
  jurisdictionLabel,
  normalizeStageEnvelope,
  resolveEffectiveWorkflowStatus,
  seoSummary,
  summarizeOutputsStage,
  type ContentStageEnvelope,
  type ContentWorkflowStep,
  type GroundingRemedyId,
} from "@/lib/content/contentTopicWorkflow";
import {
  buildEvidenceResearchFingerprint,
  classifyEvidenceBlocker,
  applyHumanVerifiedSeoClearance,
  readResearchMetaFromSeoCurrent,
  shouldAutoKickEvidenceResearch,
} from "@/lib/content/contentEvidenceResearch";
import type {
  ContentOutputKind,
  ContentOutputRow,
  ContentOutputStatus,
  ContentTopicWorkflowStatus,
  KnowledgeRow,
} from "@/types/knowledge";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  RefreshCw,
} from "lucide-react";

const STEPS: { id: ContentWorkflowStep; label: string }[] = [
  { id: "knowledge", label: "Knowledge" },
  { id: "seo", label: "SEO" },
  { id: "brief", label: "Brief" },
  { id: "outputs", label: "Outputs" },
  { id: "creative", label: "Creative" },
];

function rpcErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message;
  if (msg.includes("content_topic_exists")) {
    return "A topic already exists for this Knowledge item. Open it or choose Create another angle.";
  }
  if (msg.includes("seo_source_unavailable")) {
    return "Source content is unavailable. Resolve grounding before approving SEO.";
  }
  if (msg.includes("seo_verification_required")) {
    return "Knowledge gaps or verification checks remain. Resolve them before approving SEO.";
  }
  return msg || fallback;
}

export function AdminContentTreePanel() {
  const topicsQuery = useAdminContentTopics();
  const createTopic = useAdminCreateContentTopic();
  const generateContent = useAdminGenerateContent();
  const evidenceResearch = useContentEvidenceResearch();
  const setKnowledgeStatus = useAdminSetKnowledgeStatus();
  const upsertStage = useAdminUpsertContentTopicStage();
  const autoKickRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQuery = useAdminContentTopic(selectedId);

  const verifiedQueue = useAdminKnowledgeQueue(["verified", "published"]);
  const [linkKnowledgeId, setLinkKnowledgeId] = useState("");
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [expandedStep, setExpandedStep] = useState<ContentWorkflowStep | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const topic = detailQuery.data?.topic;
  const outputs = detailQuery.data?.outputs ?? [];
  const knowledge = detailQuery.data?.knowledge;
  const sources = detailQuery.data?.sources ?? [];
  const claims = detailQuery.data?.claims;
  const claimRows = claims ?? [];

  const workflowStatus = (topic?.workflow_status ?? "seo_review") as ContentTopicWorkflowStatus;
  const seoEnv = normalizeStageEnvelope(topic?.seo);
  const briefEnv = normalizeStageEnvelope(topic?.brief);
  const briefApproved = isBriefApproved(briefEnv);
  const researchMeta = readResearchMetaFromSeoCurrent(seoEnv.current);
  const hasUsableSourceUrl = sources.some(
    (s) => typeof s.url === "string" && /^https?:\/\//i.test(s.url.trim())
  );
  const seoReadiness = getSeoReadiness(seoEnv);
  const researchFingerprint =
    topic && knowledge
      ? buildEvidenceResearchFingerprint({
          topicId: topic.id,
          knowledgeId: knowledge.id,
          knowledgeGaps: seoReadiness.knowledgeGaps,
          sourceUnavailable: seoReadiness.sourceUnavailable,
        })
      : null;
  const accessibleOutputs = useMemo(
    () => getAccessibleOutputs(outputs, briefApproved),
    [outputs, briefApproved]
  );
  const activelyGenerating = topic
    ? isStageActivelyGenerating(workflowStatus, seoEnv, briefEnv) || generateContent.isPending
    : false;
  const effectiveWorkflowStatus = topic
    ? resolveEffectiveWorkflowStatus(workflowStatus, seoEnv, briefEnv, activelyGenerating)
    : workflowStatus;
  const activeStep = getWorkflowStep(effectiveWorkflowStatus);
  const statusDisplay = topic
    ? getWorkflowStatusDisplay({
        workflowStatus,
        seo: seoEnv,
        brief: briefEnv,
        activelyGenerating,
      })
    : null;

  const primaryAction = topic
    ? getPrimaryAction({ workflowStatus, seo: seoEnv, brief: briefEnv, outputs })
    : null;

  const showResolvePanel =
    !getSeoReadiness(seoEnv).canApprove &&
    (primaryAction?.kind === "resolve_grounding" || expandedStep === "seo");

  const seoGroundingCheckedAt =
    seoEnv.versions && seoEnv.versions.length > 0
      ? seoEnv.versions[seoEnv.versions.length - 1]?.created_at ??
        (seoEnv.versions[seoEnv.versions.length - 1]?.provenance?.generated_at as string | undefined)
      : null;

  useEffect(() => {
    // Only seed the expanded step when switching topics — do not yank the user
    // between Knowledge and SEO on every workflow/status flicker.
    setExpandedStep(activeStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: topic change only
  }, [topic?.id]);

  useEffect(() => {
    autoKickRef.current = null;
  }, [topic?.id]);

  useEffect(() => {
    if (!topic || !knowledge || !researchFingerprint) return;
    if (activelyGenerating || evidenceResearch.isPending) return;
    if (!hasSeoProposal(seoEnv) || isSeoApproved(seoEnv)) return;
    if (researchMeta.research_status === "human_verified") return;

    const blocker = classifyEvidenceBlocker({
      readiness: seoReadiness,
      claims: claimRows,
      hasUsableSourceUrl,
    });
    if (blocker !== "research_pack" && blocker !== "verify_only") return;
    if (!shouldAutoKickEvidenceResearch({ fingerprint: researchFingerprint, meta: researchMeta })) {
      return;
    }
    if (autoKickRef.current === researchFingerprint) return;
    autoKickRef.current = researchFingerprint;

    void evidenceResearch
      .run({
        topicId: topic.id,
        knowledgeId: knowledge.id,
        knowledgeTitle: knowledge.title ?? topic.title ?? "",
        applicability: (topic.applicability_snapshot ?? knowledge.applicability) as
          | Record<string, unknown>
          | null,
        seoEnvelope: seoEnv,
        claims: claimRows,
        hasUsableSourceUrl,
        auto: true,
      })
      .then((result) => {
        if (!result.ok && result.outcome === "skipped") {
          autoKickRef.current = null;
          return;
        }
        // Stay on SEO — Verify claims lives on the grounding banner. Do not bounce to Knowledge.
        if (result.ok && result.outcome === "verify_only") {
          setExpandedStep("seo");
          toast.info("Tap Verify claims on the SEO panel");
          return;
        }
        if (result.ok && result.outcome === "awaiting_human") {
          setExpandedStep("seo");
          toast.success("Evidence pack ready — tap Verify claims on the SEO panel");
          return;
        }
        if (!result.ok && result.outcome === "failed") {
          toast.error(result.reason ?? "Evidence research failed");
        }
      });
    // Intentionally keyed on fingerprint + generation gate, not full envelope identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seoEnv/claims captured when fingerprint changes
  }, [
    topic?.id,
    knowledge?.id,
    researchFingerprint,
    activelyGenerating,
    evidenceResearch.isPending,
    hasUsableSourceUrl,
    researchMeta.research_status,
    researchMeta.research_fingerprint,
  ]);

  const platformVerified = (verifiedQueue.data ?? []).filter(
    (k: KnowledgeRow) => k.scope === "platform"
  );

  const existingTopicForKnowledge = useMemo(() => {
    if (!linkKnowledgeId) return null;
    return (topicsQuery.data ?? []).find(
      (t) => t.knowledge_id === linkKnowledgeId && t.status !== "archived"
    );
  }, [linkKnowledgeId, topicsQuery.data]);

  const handleCreateTopic = () => {
    if (!linkKnowledgeId) return;
    createTopic.mutate(
      { knowledgeId: linkKnowledgeId, allowDuplicate },
      {
        onSuccess: (row) => {
          toast.success("Content topic created");
          setSelectedId(row.id);
          setLinkKnowledgeId("");
          setAllowDuplicate(false);
          generateContent.mutate(
            { topicId: row.id, stage: "seo" },
            {
              onError: (e) =>
                toast.error(rpcErrorMessage(e, "SEO generation failed — use Generate SEO opportunity")),
            }
          );
        },
        onError: (e) => toast.error(rpcErrorMessage(e, "Create topic failed")),
      }
    );
  };

  const handleVerifyClaims = () => {
    if (!topic || !knowledge) return;
    const wasPublished = knowledge.status === "published";
    const clearedCurrent = applyHumanVerifiedSeoClearance(seoEnv.current, {
      research_fingerprint: researchFingerprint ?? researchMeta.research_fingerprint,
    });
    const stampedSeo = {
      ...seoEnv,
      current: clearedCurrent,
    };

    setKnowledgeStatus.mutate(
      { knowledgeId: knowledge.id, status: "verified" },
      {
        onSuccess: () => {
          setExpandedStep("seo");
          upsertStage.mutate(
            { topicId: topic.id, seo: stampedSeo as unknown as Record<string, unknown> },
            {
              onSuccess: () => {
                toast.success(
                  wasPublished
                    ? "Claims verified — Approve SEO below (re-publish Knowledge from Review if needed)"
                    : "Claims verified — Approve SEO below"
                );
              },
              onError: (e) =>
                toast.error(
                  e instanceof Error ? e.message : "Could not update SEO after verify"
                ),
            }
          );
        },
        onError: (e) =>
          toast.error(
            e instanceof Error
              ? e.message.includes("critic_required")
                ? "Critic must pass before verifying claims — research again or run critic in Review"
                : e.message
              : "Verify failed"
          ),
      }
    );
  };

  /** For topics already stuck on human_verified with leftover soft gaps after an earlier regen. */
  const handleEnableApproveSeo = () => {
    if (!topic) return;
    const cleared = applyHumanVerifiedSeoClearance(seoEnv.current, {
      research_fingerprint: researchFingerprint ?? researchMeta.research_fingerprint,
    });
    upsertStage.mutate(
      {
        topicId: topic.id,
        seo: { ...seoEnv, current: cleared } as unknown as Record<string, unknown>,
      },
      {
        onSuccess: () => {
          setExpandedStep("seo");
          toast.success("Grounding cleared — Approve SEO below");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Could not clear SEO grounding"),
      }
    );
  };

  const handleGroundingRemedy = (remedy: GroundingRemedyId) => {
    if (!topic || !knowledge) return;
    switch (remedy) {
      case "retrieve_source":
        generateContent.mutate(
          { topicId: topic.id, stage: "seo", regenerate: true },
          {
            onSuccess: () => {
              toast.success("SEO regenerated from sources");
              autoKickRef.current = null;
            },
            onError: (e) => toast.error(rpcErrorMessage(e, "Regeneration failed")),
          }
        );
        break;
      case "add_source":
      case "return_knowledge":
        setExpandedStep("knowledge");
        toast.info(
          remedy === "return_knowledge"
            ? "Knowledge stage shows claims and sources. Prefer Verify claims on the SEO panel."
            : "Edit or add the source URL under Knowledge → Sources, then retrieve source."
        );
        break;
      case "research_evidence":
        void evidenceResearch
          .run({
            topicId: topic.id,
            knowledgeId: knowledge.id,
            knowledgeTitle: knowledge.title ?? topic.title ?? "",
            applicability: (topic.applicability_snapshot ?? knowledge.applicability) as
              | Record<string, unknown>
              | null,
            seoEnvelope: seoEnv,
            claims: claimRows,
            hasUsableSourceUrl,
            force: true,
          })
          .then((result) => {
            if (result.ok && result.outcome === "retrieve") {
              setExpandedStep("knowledge");
              toast.info("Add a reachable source URL, then research again");
              return;
            }
            if (result.ok && result.outcome === "verify_only") {
              setExpandedStep("seo");
              toast.info("Tap Verify claims on the SEO panel");
              return;
            }
            if (result.ok && result.outcome === "awaiting_human") {
              setExpandedStep("seo");
              toast.success("Evidence pack ready — tap Verify claims on the SEO panel");
              return;
            }
            if (result.ok && result.outcome === "ready") {
              toast.success("Grounding looks ready for Approve SEO");
              return;
            }
            if (!result.ok && result.outcome === "failed") {
              toast.error(result.reason ?? "Evidence research failed");
            }
          });
        break;
      default:
        break;
    }
  };

  const handlePrimaryAction = () => {
    if (!topic || !primaryAction) return;
    switch (primaryAction.kind) {
      case "generate_seo":
      case "retry":
        generateContent.mutate(
          { topicId: topic.id, stage: "seo", regenerate: primaryAction.kind === "retry" },
          {
            onSuccess: () => toast.success("SEO proposal generated"),
            onError: (e) => toast.error(rpcErrorMessage(e, "SEO generation failed")),
          }
        );
        break;
      case "approve_seo":
        setExpandedStep("seo");
        break;
      case "resolve_grounding":
        setExpandedStep("seo");
        break;
      case "generate_brief":
        generateContent.mutate(
          { topicId: topic.id, stage: "brief" },
          {
            onSuccess: () => toast.success("Editorial brief generated"),
            onError: (e) => toast.error(rpcErrorMessage(e, "Brief generation failed")),
          }
        );
        break;
      case "approve_brief":
        setExpandedStep("brief");
        break;
      case "select_outputs":
        setExpandedStep("outputs");
        break;
      case "generate_creative":
        setExpandedStep("creative");
        break;
      default:
        break;
    }
  };

  const isGenerating = activelyGenerating;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h2 className="font-medium text-sm">Content topics</h2>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs space-y-1 flex-1 min-w-[12rem]">
            <span className="text-muted-foreground">Verified / published platform Knowledge</span>
            <select
              className="w-full rounded-md bg-muted/50 px-2 py-2 text-sm"
              value={linkKnowledgeId}
              onChange={(e) => {
                setLinkKnowledgeId(e.target.value);
                setAllowDuplicate(false);
              }}
            >
              <option value="">Select knowledge…</option>
              {platformVerified.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>

          {existingTopicForKnowledge && !allowDuplicate ? (
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                size="sm"
                variant="outline"
                className="border-0 btn-neomorphic"
                onClick={() => setSelectedId(existingTopicForKnowledge.id)}
              >
                Open existing topic
              </Button>
              <Button
                size="sm"
                className="shadow-primary-btn border-0"
                disabled={createTopic.isPending}
                onClick={() => setAllowDuplicate(true)}
              >
                Create another angle
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={!linkKnowledgeId || createTopic.isPending}
              onClick={handleCreateTopic}
            >
              {createTopic.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create topic
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {(topicsQuery.data ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedId === t.id ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {(() => {
                  const tSeo = normalizeStageEnvelope(t.seo);
                  const tBrief = normalizeStageEnvelope(t.brief);
                  const tStatus = (t.workflow_status ?? "seo_review") as ContentTopicWorkflowStatus;
                  const tGenerating = isStageActivelyGenerating(tStatus, tSeo, tBrief);
                  const display = getWorkflowStatusDisplay({
                    workflowStatus: tStatus,
                    seo: tSeo,
                    brief: tBrief,
                    activelyGenerating: tGenerating,
                  });
                  return display.detail
                    ? `${display.label} · ${display.detail}`
                    : display.label;
                })()}
              </span>
            </button>
          ))}
          {!topicsQuery.isLoading && (topicsQuery.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No content topics yet.</p>
          )}
        </div>
      </section>

      {selectedId && detailQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {topic && knowledge && (
        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-4">
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-[14rem]">
                <TopicTitleEditor topicId={topic.id} title={topic.title} />
                <p className="text-xs text-muted-foreground">
                  {topic.title === knowledge.title ? (
                    <>
                      Linked Knowledge · {knowledge.status} · v{knowledge.version}
                    </>
                  ) : (
                    <>
                      Linked Knowledge:{" "}
                      <span className="font-medium text-foreground">{knowledge.title}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Jurisdiction: {jurisdictionLabel(topic.applicability_snapshot as Record<string, unknown>)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-mono uppercase text-muted-foreground">
                  {statusDisplay?.label}
                </p>
                {statusDisplay?.detail && (
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[hsl(16_72%_40%)]">
                    {statusDisplay.detail}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Stage: {activeStep}</p>
              </div>
            </div>

            {primaryAction && primaryAction.kind !== "none" && (
              <Button
                size="sm"
                className={cn(
                  "shadow-primary-btn border-0",
                  primaryAction.kind === "resolve_grounding" &&
                    "bg-[hsl(16_82%_56%)] hover:bg-[hsl(16_82%_50%)] text-white"
                )}
                disabled={isGenerating}
                onClick={handlePrimaryAction}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {primaryAction.label}
              </Button>
            )}

            {(() => {
              const rawError = seoEnv.last_error || briefEnv.last_error;
              const staleStrategyCrash = /strategy.*replace is not a function/i.test(rawError ?? "");
              const hideStaleCrash = staleStrategyCrash && Boolean(seoEnv.current && Object.keys(seoEnv.current).length);
              const message = hideStaleCrash
                ? null
                : rawError || (workflowStatus === "generation_failed"
                  ? "Generation failed. Review the cause and retry."
                  : null);
              return message ? (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {message}
                </div>
              ) : null;
            })()}
          </header>

          <nav className="flex flex-wrap gap-1">
            {STEPS.map((step, i) => {
              const done = isStepComplete(step.id, workflowStatus, seoEnv, briefEnv);
              const current = step.id === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    current ? "bg-primary/15 text-primary" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      done ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {step.label}
                </button>
              );
            })}
          </nav>

          <div className="space-y-2">
            {STEPS.map((step) => (
              <StageSection
                key={step.id}
                step={step.id}
                expanded={expandedStep === step.id}
                onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                complete={isStepComplete(step.id, workflowStatus, seoEnv, briefEnv)}
                summary={
                  step.id === "knowledge"
                    ? `${knowledge.status} · v${knowledge.version}`
                    : step.id === "seo"
                      ? seoSummary(seoEnv)
                      : step.id === "brief"
                        ? briefSummary(briefEnv)
                        : step.id === "outputs"
                          ? summarizeOutputsStage(outputs, briefApproved)
                          : topic.creative && Object.keys(topic.creative).length > 0
                            ? "Visual concept started"
                            : "Not started"
                }
                summarySuffix={
                  step.id === "knowledge" && sources.length > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline shrink-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEvidenceOpen(true);
                      }}
                    >
                      {sources.length} source{sources.length === 1 ? "" : "s"}
                    </button>
                  ) : undefined
                }
              >
                {step.id === "knowledge" && (
                  <KnowledgeStage
                    topicId={topic.id}
                    knowledge={knowledge}
                    sources={sources}
                    claims={claimRows}
                    highlightVerify={
                      researchMeta.research_status === "awaiting_human" ||
                      researchMeta.research_status === "verify_only" ||
                      evidenceResearch.phase === "awaiting_human" ||
                      evidenceResearch.phase === "verify_only"
                    }
                    onVerifyClaims={
                      researchMeta.research_status === "human_verified"
                        ? undefined
                        : handleVerifyClaims
                    }
                    verifyBusy={setKnowledgeStatus.isPending || generateContent.isPending}
                  />
                )}
                {step.id === "seo" && (
                  <SeoStage
                    topicId={topic.id}
                    envelope={seoEnv}
                    workflowStatus={workflowStatus}
                    busy={isGenerating || evidenceResearch.isPending}
                    applicability={topic.applicability_snapshot as Record<string, unknown>}
                    showResolvePanel={showResolvePanel}
                    onRemedy={handleGroundingRemedy}
                    sourceCount={sources.length}
                    groundingCheckedAt={seoGroundingCheckedAt ?? null}
                    researchPhase={
                      researchMeta.research_status === "human_verified"
                        ? "idle"
                        : evidenceResearch.phase
                    }
                    researchMeta={researchMeta}
                    onVerifyClaims={
                      researchMeta.research_status === "human_verified"
                        ? undefined
                        : handleVerifyClaims
                    }
                    onEnableApprove={
                      researchMeta.research_status === "human_verified" &&
                      !getSeoReadiness(seoEnv).canApprove
                        ? handleEnableApproveSeo
                        : undefined
                    }
                    verifyBusy={
                      setKnowledgeStatus.isPending ||
                      upsertStage.isPending ||
                      generateContent.isPending
                    }
                  />
                )}
                {step.id === "brief" && (
                  <BriefStage
                    topicId={topic.id}
                    envelope={briefEnv}
                    seoApproved={isSeoApproved(seoEnv)}
                    workflowStatus={workflowStatus}
                    busy={isGenerating}
                  />
                )}
                {step.id === "outputs" && (
                  <OutputsStage
                    topicId={topic.id}
                    outputs={accessibleOutputs}
                    allOutputs={outputs}
                    briefApproved={briefApproved}
                    workflowStatus={effectiveWorkflowStatus}
                    busy={isGenerating}
                  />
                )}
                {step.id === "creative" && (
                  <CreativeStage
                    topicId={topic.id}
                    creative={topic.creative}
                    briefApproved={isBriefApproved(briefEnv)}
                    workflowStatus={workflowStatus}
                    busy={isGenerating}
                  />
                )}
              </StageSection>
            ))}
          </div>
          <AdminContentEvidenceDrawer
            open={evidenceOpen}
            onOpenChange={setEvidenceOpen}
            sources={sources}
            knowledgeStatus={knowledge.status}
            sourceUnavailable={getSeoReadiness(seoEnv).sourceUnavailable}
          />
        </section>
      )}
    </div>
  );
}

function TopicTitleEditor({ topicId, title }: { topicId: string; title: string }) {
  const upsertStage = useAdminUpsertContentTopicStage();
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);

  return (
    <Input
      className="text-base font-semibold bg-transparent border-0 pl-3 pr-0 h-auto focus-visible:ring-0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim() && value !== title) {
          upsertStage.mutate({ topicId, title: value.trim() });
        }
      }}
    />
  );
}

function StageSection({
  step,
  expanded,
  onToggle,
  complete,
  summary,
  summarySuffix,
  children,
}: {
  step: ContentWorkflowStep;
  expanded: boolean;
  onToggle: () => void;
  complete: boolean;
  summary: string;
  summarySuffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  const label = STEPS.find((s) => s.id === step)?.label ?? step;
  return (
    <div className="rounded-lg bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="font-medium">{label}</span>
        {complete && step !== "knowledge" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary">
            <Check className="h-3.5 w-3.5" />
            Approved
          </span>
        )}
        {complete && step === "knowledge" && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
        {!expanded && (
          <span className="text-xs text-muted-foreground ml-auto truncate max-w-[55%] flex items-center gap-2 justify-end">
            <span className="truncate">{summary}</span>
            {summarySuffix}
          </span>
        )}
      </button>
      {expanded && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function KnowledgeStage({
  topicId: _topicId,
  knowledge,
  sources,
  claims,
  highlightVerify,
  onVerifyClaims,
  verifyBusy,
}: {
  topicId: string;
  knowledge: KnowledgeRow;
  sources: { id?: string; label: string | null; url: string | null; source_type: string }[];
  claims: Array<Record<string, unknown>>;
  highlightVerify?: boolean;
  onVerifyClaims?: () => void;
  verifyBusy?: boolean;
}) {
  const detail = useAdminKnowledgeDetail(knowledge.id);
  const detailClaims = (detail.data?.claims ?? []) as Array<Record<string, unknown>>;
  const mergedClaims = detailClaims.length > 0 ? detailClaims : claims;

  const claimRows = mergedClaims
    .filter((c) => typeof c.claim_text === "string" && String(c.claim_text).trim())
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : undefined,
      claim_text: String(c.claim_text),
      category: typeof c.category === "string" ? c.category : undefined,
      verification_status:
        typeof c.verification_status === "string" ? c.verification_status : undefined,
      source_id: typeof c.source_id === "string" ? c.source_id : null,
      source_location:
        typeof c.source_location === "string" ? c.source_location : null,
    }));

  const extractedCount = claimRows.filter(
    (c) => String(c.verification_status ?? "extracted").toLowerCase() === "extracted"
  ).length;
  const unknownCount = claimRows.filter((c) => {
    const s = String(c.verification_status ?? "").toLowerCase();
    return s === "unknown" || s === "unresolved";
  }).length;

  // Always show when research is waiting on the human, even if claims are still loading.
  const showVerify =
    (Boolean(highlightVerify) || extractedCount > 0) && Boolean(onVerifyClaims);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground line-clamp-4">
        {knowledge.summary || knowledge.body || "—"}
      </p>
      <p className="text-xs font-mono text-muted-foreground">
        {knowledge.status} · v{knowledge.version}
      </p>

      <div
        className={cn(
          "space-y-2 rounded-lg px-2.5 py-2",
          highlightVerify || extractedCount > 0 ? "bg-primary/10 shadow-sm" : "bg-transparent"
        )}
      >
        {detail.isLoading && claimRows.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading claims…
          </p>
        ) : (
          <KnowledgeClaimsList
            claims={claimRows}
            sources={sources
              .filter((s): s is typeof s & { id: string } => typeof s.id === "string")
              .map((s) => ({
                id: s.id,
                label: s.label,
                url: s.url,
              }))}
            compact
            emptyHint="No claims yet. Research missing evidence or extract claims in Review."
          />
        )}
        {extractedCount > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            {extractedCount} claim{extractedCount === 1 ? "" : "s"} waiting for human verify
            {unknownCount > 0
              ? ` · ${unknownCount} gap${unknownCount === 1 ? "" : "s"} stay unknown`
              : ""}
            . Verify promotes source-backed claims only.
          </p>
        ) : highlightVerify ? (
          <p className="text-[10px] text-muted-foreground">
            Confirm Knowledge claims to unlock Approve SEO. Unknown gaps stay unresolved.
          </p>
        ) : null}
        {showVerify ? (
          <Button
            type="button"
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={verifyBusy}
            onClick={onVerifyClaims}
          >
            {verifyBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Verifying…
              </>
            ) : (
              "Verify claims"
            )}
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Sources</p>
        <KnowledgeSourceUrlEditor
          knowledgeId={knowledge.id}
          compact
          sources={sources.map((s) => ({
            id: s.id,
            title: s.label,
            url: s.url,
            label: s.label,
          }))}
        />
      </div>
    </div>
  );
}

function BriefStage({
  topicId,
  envelope,
  seoApproved,
  workflowStatus,
  busy,
}: {
  topicId: string;
  envelope: ContentStageEnvelope;
  seoApproved: boolean;
  workflowStatus: ContentTopicWorkflowStatus;
  busy: boolean;
}) {
  const generate = useAdminGenerateContent();
  const approve = useAdminApproveContentTopicBrief();
  const reject = useAdminRejectContentTopicBrief();
  const upsert = useAdminUpsertContentTopicStage();
  const c = envelope.current ?? {};

  const [angle, setAngle] = useState(String(c.content_angle ?? c.angle ?? ""));
  const [title, setTitle] = useState(String(c.working_title ?? c.title ?? ""));
  const [reader, setReader] = useState(String(c.intended_reader ?? ""));
  const [outcome, setOutcome] = useState(String(c.reader_outcome ?? ""));
  const [sections, setSections] = useState(
    Array.isArray(c.proposed_sections ?? c.sections)
      ? ((c.proposed_sections ?? c.sections) as string[]).join("\n")
      : ""
  );
  const [questions, setQuestions] = useState(
    Array.isArray(c.questions_to_answer ?? c.questions)
      ? ((c.questions_to_answer ?? c.questions) as string[]).join("\n")
      : ""
  );
  const [distinctions, setDistinctions] = useState(
    Array.isArray(c.legal_factual_distinctions)
      ? (c.legal_factual_distinctions as string[]).join("\n")
      : ""
  );
  const [sourcePoints, setSourcePoints] = useState(
    Array.isArray(c.required_source_points) ? (c.required_source_points as string[]).join("\n") : ""
  );
  const [cautious, setCautious] = useState(
    Array.isArray(c.cautious_claims) ? (c.cautious_claims as string[]).join("\n")
      : ""
  );
  const [cta, setCta] = useState(String(c.suggested_cta ?? c.cta ?? ""));
  const [outputs, setOutputs] = useState(
    Array.isArray(c.recommended_output_types)
      ? (c.recommended_output_types as string[]).join(", ")
      : ""
  );
  const [visual, setVisual] = useState(String(c.visual_concept_suggestion ?? ""));

  useEffect(() => {
    const cur = envelope.current ?? {};
    setAngle(String(cur.content_angle ?? cur.angle ?? ""));
    setTitle(String(cur.working_title ?? cur.title ?? ""));
    setReader(String(cur.intended_reader ?? ""));
    setOutcome(String(cur.reader_outcome ?? ""));
    setSections(
      Array.isArray(cur.proposed_sections ?? cur.sections)
        ? ((cur.proposed_sections ?? cur.sections) as string[]).join("\n")
        : ""
    );
    setQuestions(
      Array.isArray(cur.questions_to_answer ?? cur.questions)
        ? ((cur.questions_to_answer ?? cur.questions) as string[]).join("\n")
        : ""
    );
    setDistinctions(
      Array.isArray(cur.legal_factual_distinctions)
        ? (cur.legal_factual_distinctions as string[]).join("\n")
        : ""
    );
    setSourcePoints(
      Array.isArray(cur.required_source_points) ? (cur.required_source_points as string[]).join("\n") : ""
    );
    setCautious(
      Array.isArray(cur.cautious_claims) ? (cur.cautious_claims as string[]).join("\n") : ""
    );
    setCta(String(cur.suggested_cta ?? cur.cta ?? ""));
    setOutputs(
      Array.isArray(cur.recommended_output_types)
        ? (cur.recommended_output_types as string[]).join(", ")
        : ""
    );
    setVisual(String(cur.visual_concept_suggestion ?? ""));
  }, [envelope]);

  if (!seoApproved) {
    return <p className="text-xs text-muted-foreground">Approve SEO before generating the editorial brief.</p>;
  }

  const hasProposal = Boolean(title.trim());

  const buildPayload = () => ({
    content_angle: angle,
    working_title: title,
    intended_reader: reader,
    reader_outcome: outcome,
    proposed_sections: sections.split("\n").map((s) => s.trim()).filter(Boolean),
    questions_to_answer: questions.split("\n").map((s) => s.trim()).filter(Boolean),
    legal_factual_distinctions: distinctions.split("\n").map((s) => s.trim()).filter(Boolean),
    required_source_points: sourcePoints.split("\n").map((s) => s.trim()).filter(Boolean),
    cautious_claims: cautious.split("\n").map((s) => s.trim()).filter(Boolean),
    suggested_cta: cta,
    recommended_output_types: outputs.split(",").map((s) => s.trim()).filter(Boolean),
    visual_concept_suggestion: visual,
  });

  if (!hasProposal) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">No brief yet.</p>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy || generate.isPending}
          onClick={() =>
            generate.mutate(
              { topicId, stage: "brief" },
              {
                onSuccess: () => toast.success("Brief generated"),
                onError: (e) => toast.error(rpcErrorMessage(e, "Brief generation failed")),
              }
            )
          }
        >
          Generate editorial brief
        </Button>
        <ContentQueueOvernightButton topicId={topicId} stage="brief" disabled={busy} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {envelope.stale && (
        <p className="text-xs text-amber-600">Upstream changes may affect this brief.</p>
      )}
      <Input placeholder="Content angle" value={angle} onChange={(e) => setAngle(e.target.value)} />
      <Input placeholder="Working title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Intended reader" value={reader} onChange={(e) => setReader(e.target.value)} />
      <Input placeholder="Reader outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      <Textarea placeholder="Proposed sections" value={sections} onChange={(e) => setSections(e.target.value)} rows={3} />
      <Textarea placeholder="Questions to answer" value={questions} onChange={(e) => setQuestions(e.target.value)} rows={3} />
      <Textarea placeholder="Legal / factual distinctions" value={distinctions} onChange={(e) => setDistinctions(e.target.value)} rows={2} />
      <Textarea placeholder="Required source points" value={sourcePoints} onChange={(e) => setSourcePoints(e.target.value)} rows={2} />
      <Textarea placeholder="Claims needing cautious wording" value={cautious} onChange={(e) => setCautious(e.target.value)} rows={2} />
      <Input placeholder="Suggested CTA" value={cta} onChange={(e) => setCta(e.target.value)} />
      <Input placeholder="Recommended output types" value={outputs} onChange={(e) => setOutputs(e.target.value)} />
      <Textarea placeholder="Visual concept suggestion" value={visual} onChange={(e) => setVisual(e.target.value)} rows={2} />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => {
            const next = { ...envelope, current: buildPayload() };
            upsert.mutate({ topicId, brief: next }, { onSuccess: () => toast.success("Brief saved") });
          }}
        >
          Save changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy || generate.isPending}
          onClick={() =>
            generate.mutate(
              { topicId, stage: "brief", regenerate: true },
              { onSuccess: () => toast.success("Brief regenerated") }
            )
          }
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
        </Button>
        {envelope.approval_status !== "approved" && (
          <>
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy || approve.isPending}
              onClick={() => {
                const next = { ...envelope, current: buildPayload() };
                approve.mutate(
                  { topicId, brief: next },
                  { onSuccess: () => toast.success("Brief approved — outputs unlocked") }
                );
              }}
            >
              Approve brief
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic"
              disabled={busy}
              onClick={() => reject.mutate({ topicId }, { onSuccess: () => toast.success("Brief rejected") })}
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function OutputsStage({
  topicId,
  outputs,
  allOutputs,
  briefApproved,
  workflowStatus,
  busy,
}: {
  topicId: string;
  outputs: ContentOutputRow[];
  allOutputs: ContentOutputRow[];
  briefApproved: boolean;
  workflowStatus: ContentTopicWorkflowStatus;
  busy: boolean;
}) {
  const generate = useAdminGenerateContent();
  const upsertOutput = useAdminUpsertContentOutput();
  const setOutputStatus = useAdminSetContentOutputStatus();
  const [selected, setSelected] = useState<ContentOutputKind[]>([]);

  if (!briefApproved) {
    return (
      <p className="text-xs text-muted-foreground">
        Locked until the editorial brief is approved.
        {allOutputs.length > 0
          ? ` (${allOutputs.length} legacy placeholder${allOutputs.length === 1 ? "" : "s"} hidden)`
          : ""}
      </p>
    );
  }

  const existingKinds = new Set(outputs.map((o) => o.output_kind));

  return (
    <div className="space-y-3">
      {!canGenerateOutputs(workflowStatus, { approval_status: "approved" }) && outputs.length === 0 ? null : (
        <>
          <p className="text-xs text-muted-foreground">Select output types to generate:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTPUT_KIND_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex gap-2 rounded-lg p-2 cursor-pointer text-sm ${
                  selected.includes(opt.id) ? "bg-primary/10" : "bg-muted/30"
                } ${existingKinds.has(opt.id) ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  disabled={existingKinds.has(opt.id)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, opt.id] : prev.filter((k) => k !== opt.id)
                    );
                  }}
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy || generate.isPending}
              onClick={() =>
                generate.mutate(
                  { topicId, stage: "output", outputKinds: selected },
                  {
                    onSuccess: () => {
                      toast.success("Outputs generated");
                      setSelected([]);
                    },
                    onError: (e) => toast.error(rpcErrorMessage(e, "Output generation failed")),
                  }
                )
              }
            >
              Generate selected ({selected.length})
            </Button>
            <ContentQueueOvernightButton
              topicId={topicId}
              stage="output"
              outputKinds={selected}
              disabled={busy}
            />
            </div>
          )}
        </>
      )}

      {outputs.map((o) => (
        <OutputEditor
          key={o.id}
          row={o}
          busy={upsertOutput.isPending || setOutputStatus.isPending}
          onSave={(title, body) =>
            upsertOutput.mutate(
              {
                topicId,
                outputKind: o.output_kind,
                title,
                body,
                status: o.status === "approved" ? "draft" : undefined,
              },
              { onSuccess: () => toast.success("Output saved") }
            )
          }
          onStatus={(status) =>
            setOutputStatus.mutate(
              { outputId: o.id, status, topicId },
              { onSuccess: () => toast.success(`Output → ${status}`) }
            )
          }
        />
      ))}
    </div>
  );
}

function CreativeStage({
  topicId,
  creative,
  briefApproved,
  workflowStatus,
  busy,
}: {
  topicId: string;
  creative: Record<string, unknown>;
  briefApproved: boolean;
  workflowStatus: ContentTopicWorkflowStatus;
  busy: boolean;
}) {
  const generate = useAdminGenerateContent();
  const upsert = useAdminUpsertContentTopicStage();
  const visualBrief = (creative.visual_brief ?? {}) as Record<string, unknown>;
  const testAssets = (creative.test_assets ?? {}) as Record<string, unknown>;
  const finalAssets = (creative.final_assets ?? {}) as Record<string, unknown>;

  if (!briefApproved) {
    return <p className="text-xs text-muted-foreground">Approve the brief before creative work.</p>;
  }

  if (!visualBrief.concept_summary) {
    return (
      <Button
        size="sm"
        className="shadow-primary-btn border-0"
        disabled={busy || generate.isPending}
        onClick={() =>
          generate.mutate(
            { topicId, stage: "visual_concept" },
            { onSuccess: () => toast.success("Visual concept created") }
          )
        }
      >
        Create visual concept
      </Button>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p>{String(visualBrief.concept_summary)}</p>
      <p className="text-xs text-muted-foreground">Style: Filla layered paper-cut · no rendered text</p>
      {Boolean(testAssets.thumbnail_prompt) && (
        <div className="rounded-lg bg-muted/30 p-2 text-xs space-y-1">
          <p className="font-medium">Test assets (prompts)</p>
          <p>Thumbnail: {String(testAssets.thumbnail_prompt).slice(0, 120)}…</p>
          <p>Square test: {String(testAssets.test_square_prompt).slice(0, 120)}…</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {testAssets.status !== "approved" && (
          <>
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy}
              onClick={() =>
                upsert.mutate({
                  topicId,
                  creative: {
                    ...creative,
                    test_assets: { ...testAssets, status: "approved" },
                  },
                  workflowStatus: "generating_final_assets",
                })
              }
            >
              Approve test image
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic"
              disabled={busy || generate.isPending}
              onClick={() =>
                generate.mutate({ topicId, stage: "visual_concept", regenerate: true })
              }
            >
              Regenerate concept
            </Button>
          </>
        )}
        {testAssets.status === "approved" && !finalAssets.master_square_prompt && (
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy || generate.isPending}
            onClick={() =>
              generate.mutate(
                { topicId, stage: "visual_final" },
                { onSuccess: () => toast.success("Final asset prompts generated") }
              )
            }
          >
            Generate final variants
          </Button>
        )}
        {Boolean(finalAssets.master_square_prompt) && (
          <div className="w-full rounded-lg bg-muted/30 p-2 text-xs space-y-1">
            <p className="font-medium">Final derivatives (from approved master)</p>
            <p>Square master prompt ready</p>
            <p>Portrait: subject upper, quiet lower text-safe area</p>
            <p>Landscape: subject right, quiet left text-safe area</p>
            <p className="text-muted-foreground">Publishing integration remains a later step.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const OUTPUT_LABELS: Record<ContentOutputKind, string> = Object.fromEntries(
  OUTPUT_KIND_OPTIONS.map((o) => [o.id, o.label])
) as Record<ContentOutputKind, string>;

function OutputEditor({
  row,
  busy,
  onSave,
  onStatus,
}: {
  row: ContentOutputRow;
  busy: boolean;
  onSave: (title: string, body: string) => void;
  onStatus: (status: ContentOutputStatus) => void;
}) {
  const [title, setTitle] = useState(row.title ?? "");
  const [body, setBody] = useState(row.body ?? "");

  useEffect(() => {
    setTitle(row.title ?? "");
    setBody(row.body ?? "");
  }, [row.id, row.updated_at]);

  if (!row.body && !row.title) return null;

  return (
    <div className="rounded-lg bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{OUTPUT_LABELS[row.output_kind]}</p>
        <span className="text-xs font-mono uppercase text-muted-foreground">{row.status}</span>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Content"
        rows={row.output_kind === "core_article" ? 8 : 4}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="shadow-primary-btn border-0" disabled={busy} onClick={() => onSave(title, body)}>
          Save
        </Button>
        <Button size="sm" variant="outline" className="border-0 btn-neomorphic" disabled={busy} onClick={() => onStatus("needs_review")}>
          Needs review
        </Button>
        <Button size="sm" variant="outline" className="border-0 btn-neomorphic" disabled={busy} onClick={() => onStatus("approved")}>
          Approve
        </Button>
        <Button size="sm" variant="outline" className="border-0 btn-neomorphic" disabled={busy} onClick={() => onStatus("rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}
