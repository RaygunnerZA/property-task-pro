/**
 * Subject package workspace — decisions only.
 * Title, coverage, the next human decision, then what Filla will do.
 * Evidence and activity is a disclosure.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  useAdminApproveContentPlan,
  useAdminContentTopic,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminResearchKnowledgeGaps,
  useAdminSetContentOutputStatus,
  useAdminUpsertContentStrategy,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { Button } from "@/components/ui/button";
import {
  formKindLabel,
  normalizeParentStrategy,
  recommendContentPlan,
  type ContentParentStrategy,
  type ContentScope,
} from "@/lib/content/contentPlan";
import { normalizeSeoProposal, normalizeStageEnvelope } from "@/lib/content/contentTopicWorkflow";
import {
  coverageProgressHint,
  draftBodyToReadableProse,
  mergeSchedulePrefsIntoPublishing,
  type PackagePrimaryKind,
  type SubjectPackage,
} from "@/lib/content/knowledgeSubjectPackage";
import {
  coverageDecisionLabels,
  coverageNavTarget,
  draftDriftedFromSubject,
  isPlaceholderOutput,
  joinList,
  knowledgeIdForReviewDecision,
  nextAutomaticCopy,
  nextDecisionCopy,
} from "@/lib/content/knowledgePackagePilot";
import { confidenceLabel } from "@/lib/content/knowledgeWatch";
import { useKnowledgeWatchSettings } from "@/hooks/admin/useKnowledgeWatch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminKnowledgeDetailSheet } from "@/components/admin/AdminKnowledgeDetailSheet";

function rpcError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  return e.message || fallback;
}

async function uploadContentTopicImage(input: {
  topicSlug: string;
  kind: "thumbnail" | "square" | "vertical" | "horizontal";
  file: File;
}): Promise<string> {
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "webp";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "webp";
  const slug = input.topicSlug.replace(/[^a-z0-9-_]/gi, "-").toLowerCase().slice(0, 80) || "topic";
  const path = `content/${slug}/${input.kind}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from("knowledge-content-images").upload(path, input.file, {
    upsert: true,
    contentType: input.file.type || `image/${safeExt}`,
  });
  if (error) throw error;
  return path;
}

function publicContentImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("knowledge-content-images").getPublicUrl(path);
  return data.publicUrl || null;
}

function formatAttempt(iso: string | null | undefined): string {
  if (!iso) return "None yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "None yet";
  return d.toLocaleString();
}

function outputReviewerLabel(
  kind: string | null | undefined,
  title: string | null | undefined
): string {
  if (title?.trim()) return title.trim();
  return formKindLabel(kind ?? "") || "Draft";
}

function coverageStatusLabel(status: string): string {
  if (status === "Sourced" || status === "Ready") return "Covered";
  if (status === "Needs a decision") return "Candidate found";
  if (status === "Being researched") return "Researching";
  if (status === "Incomplete") return "Not ready";
  return status;
}

type Props = {
  pkg: SubjectPackage;
  onBack: () => void;
  onPackageUpdated?: () => void;
};

export function AdminKnowledgePackageWorkspace({ pkg, onBack, onPackageUpdated }: Props) {
  const [topicId, setTopicId] = useState<string | null>(pkg.topic?.id ?? null);
  const detailQuery = useAdminContentTopic(topicId);
  const createTopic = useAdminCreateContentTopic();
  const generate = useAdminGenerateContent();
  const upsertStrategy = useAdminUpsertContentStrategy();
  const approvePlan = useAdminApproveContentPlan();
  const setOutputStatus = useAdminSetContentOutputStatus();
  const upsertStage = useAdminUpsertContentTopicStage();
  const researchGaps = useAdminResearchKnowledgeGaps();

  const [focusKnowledgeId, setFocusKnowledgeId] = useState<string | null>(null);
  const [focusOutputId, setFocusOutputId] = useState<string | null>(null);

  const topic = detailQuery.data?.topic ?? pkg.topic;
  const knowledge = detailQuery.data?.knowledge;
  const outputs = detailQuery.data?.outputs ?? [];
  const sources = detailQuery.data?.sources ?? [];
  const claims = detailQuery.data?.claims ?? [];

  const seoEnv = normalizeStageEnvelope(topic?.seo);
  const seoProposal = normalizeSeoProposal(seoEnv.current ?? seoEnv.approved ?? {});

  const strategy = useMemo(() => {
    const base = normalizeParentStrategy(topic?.strategy ?? pkg.strategy);
    if (base.primary_form) return base;
    const seed = pkg.knowledgeRows[0] ?? knowledge;
    if (!seed) return base;
    const applicability = (seed.applicability ?? {}) as {
      jurisdictions?: string[];
      unscoped?: boolean;
    };
    return {
      ...recommendContentPlan({
        channel: topic?.channel ?? "website_blog_social",
        knowledgeTitle: pkg.title,
        jurisdictions: applicability.jurisdictions ?? [],
        unscoped: applicability.unscoped,
        propertyJurisdictionKnown: false,
        scopeOverride: (topic?.content_scope as ContentScope) || "international_overview",
      }),
      ...base,
    };
  }, [topic, knowledge, pkg]);

  const draft = strategy;

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editRaw, setEditRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  const creative = (topic?.creative ?? {}) as Record<string, unknown>;
  const finalAssets =
    creative.final_assets && typeof creative.final_assets === "object"
      ? (creative.final_assets as Record<string, unknown>)
      : {};
  const imagePaths = {
    square:
      (typeof finalAssets.square_path === "string" && finalAssets.square_path) ||
      (typeof creative.square_path === "string" && creative.square_path) ||
      null,
    thumbnail:
      (typeof finalAssets.thumbnail_path === "string" && finalAssets.thumbnail_path) ||
      (typeof creative.thumbnail_path === "string" && creative.thumbnail_path) ||
      null,
    vertical:
      (typeof finalAssets.vertical_path === "string" && finalAssets.vertical_path) || null,
    horizontal:
      (typeof finalAssets.horizontal_path === "string" && finalAssets.horizontal_path) ||
      null,
  };
  const hasUploadedImage = Boolean(imagePaths.square || imagePaths.thumbnail);
  const imagesDeliverable = pkg.deliverables.find((d) => d.id === "images");
  const imagesUploadUnlocked =
    hasUploadedImage || imagesDeliverable?.state === "Ready to upload";
  const topicSlug =
    pkg.subjectKey.replace(/[^a-z0-9-_]/gi, "-").toLowerCase().slice(0, 80) || "topic";

  const decisionRows = pkg.knowledgeRows.filter((r) =>
    pkg.decisionKnowledgeIds.includes(r.id)
  );

  const generating =
    generate.isPending ||
    approvePlan.isPending ||
    createTopic.isPending ||
    topic?.workflow_status === "generating_plan" ||
    topic?.workflow_status === "generating_content";

  const pendingOutputs = outputs.filter(
    (o) => o.status === "draft" || o.status === "needs_review"
  );
  const planAccepted = draft.approval_status === "approved";
  const intlCoverageBlocked = pkg.deliverables.some(
    (d) =>
      (d.id === "international-article" || d.id === "social") && d.state === "Blocked"
  );
  const eligiblePendingOutputs = pendingOutputs.filter((o) => {
    if (draftDriftedFromSubject(pkg.subjectKey, o)) return false;
    if (
      intlCoverageBlocked &&
      (o.output_kind === "core_article" ||
        o.output_kind === "social_post" ||
        o.output_kind === "social_carousel")
    ) {
      return false;
    }
    return true;
  });
  const staleDraftCount = outputs.filter((o) =>
    draftDriftedFromSubject(pkg.subjectKey, o)
  ).length;

  let primaryKind: PackagePrimaryKind = pkg.primaryKind;
  if (decisionRows.length > 0) {
    primaryKind = "resolve_gap";
  } else if (generating) {
    primaryKind = "none";
  } else if (pkg.primaryKind === "resolve_gap") {
    primaryKind = "resolve_gap";
  } else if (!planAccepted && pkg.primaryKind === "accept_plan") {
    primaryKind = "accept_plan";
  } else if (planAccepted && eligiblePendingOutputs.length > 0) {
    primaryKind = "review_drafts";
  } else if (
    planAccepted &&
    outputs.length > 0 &&
    pendingOutputs.length === 0 &&
    !pkg.prefs.distribution_ready_at
  ) {
    primaryKind = "approve_distribution";
  } else if (pkg.prefs.distribution_ready_at) {
    primaryKind = "view";
  } else {
    primaryKind = pkg.primaryKind;
  }

  const missingRegions = pkg.resolveGapJurisdictions;

  const watchSettings = useKnowledgeWatchSettings();
  const automatedResearchOn = watchSettings.data?.automated_research === "on";
  const lastWatchRun = watchSettings.data?.last_run ?? null;

  const decisionRegions = coverageDecisionLabels(pkg.coverage);
  const decisionCopy = nextDecisionCopy({
    primaryKind,
    missingRegions,
    decisionKnowledgeIds: pkg.decisionKnowledgeIds,
    decisionRegions,
    staleDraftCount,
  });

  const intlOk =
    pkg.coverage.filter(
      (c) => c.id !== "international" && (c.status === "Sourced" || c.status === "Ready")
    ).length >= 2;
  const automaticCopy = nextAutomaticCopy({
    missingRegions,
    comparisonReady: intlOk,
    planAccepted,
  });
  const watchRunInProgress = lastWatchRun?.status === "running" || researchGaps.isPending;
  const researchAutomatic = automatedResearchOn || watchRunInProgress;
  const visibleOutputs = outputs.filter(
    (o) => !isPlaceholderOutput(o, draft.content_scope || topic?.content_scope)
  );
  const evidenceSignals = pkg.discoverySignals.filter(
    (s) => s.sourceUrls.length > 0 || s.type !== "knowledge_gap"
  );
  const needsDecision = primaryKind !== "view" && primaryKind !== "none";
  const reviewerCoverage = pkg.coverage.filter(
    (c) =>
      c.id !== "international" &&
      (c.status === "Needs a decision" || c.status === "Sourced" || c.status === "Ready")
  );
  const researchingRegions = pkg.coverage
    .filter((c) => c.id !== "international" && c.status === "Being researched")
    .map((c) => c.label);

  const researchMissingRegions = async () => {
    if (missingRegions.length === 0) {
      toast.message("No missing priority regions for this subject");
      return;
    }
    setBusy(true);
    try {
      const topic_key = pkg.subjectKey.slice(0, 48).toLowerCase();
      const gaps = missingRegions.map((jurisdiction) => ({
        id: `${topic_key}::${jurisdiction.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 160),
        topic_key,
        topic: pkg.title.slice(0, 80),
        jurisdiction,
        status: "partial" as const,
      }));
      const result = await researchGaps.mutateAsync({ gaps });
      toast.success(
        `Researched ${joinList(missingRegions)} — ${result.createdCount} candidate(s) added.`
      );
      onPackageUpdated?.();
    } catch (e) {
      toast.error(rpcError(e, "Could not research missing regions"));
    } finally {
      setBusy(false);
    }
  };

  const ensureTopic = async (): Promise<string> => {
    if (topicId) return topicId;
    const knowledgeId = pkg.primaryKnowledgeId ?? pkg.knowledgeRows[0]?.id;
    if (!knowledgeId) {
      throw new Error("No Knowledge linked to this subject yet");
    }
    const row = await createTopic.mutateAsync({
      knowledgeId,
      title: pkg.title,
    });
    const publishing = mergeSchedulePrefsIntoPublishing(row.publishing, {
      pinned: pkg.prefs.pinned,
      reason_override: pkg.prefs.reason_override,
    });
    await upsertStage.mutateAsync({ topicId: row.id, publishing });
    setTopicId(row.id);
    return row.id;
  };

  const openKnowledgeDecision = (region?: string | null): boolean => {
    const knowledgeId = knowledgeIdForReviewDecision({
      coverage: pkg.coverage,
      decisionRegion: region ?? null,
      decisionKnowledgeIds: pkg.decisionKnowledgeIds,
      rows: pkg.knowledgeRows,
      subjectKey: pkg.subjectKey,
    });
    if (!knowledgeId) return false;
    setFocusKnowledgeId(knowledgeId);
    return true;
  };

  const runPrimary = async () => {
    setBusy(true);
    try {
      if (primaryKind === "view") {
        onBack();
        return;
      }
      if (primaryKind === "resolve_gap") {
        if (openKnowledgeDecision(decisionRegions[0] ?? null)) return;
        if (missingRegions.length > 0 && !automatedResearchOn) {
          await researchMissingRegions();
        } else {
          toast.message("No open candidate for this package.");
        }
        return;
      }
      const id = await ensureTopic();

      if (primaryKind === "accept_plan") {
        await upsertStrategy.mutateAsync({
          topicId: id,
          strategy: { ...draft, approval_status: "pending" },
          contentScope: draft.content_scope || "international_overview",
          channel: draft.channel || "website_blog_social",
        });
        await approvePlan.mutateAsync({
          topicId: id,
          strategy: { ...draft, approval_status: "approved" },
        });
        await upsertStage.mutateAsync({
          topicId: id,
          publishing: mergeSchedulePrefsIntoPublishing(topic?.publishing ?? {}, {
            schedule_state: "confirmed",
            window_label: pkg.windowLabel ?? undefined,
            window_start: pkg.windowStart ?? undefined,
          }),
        });
        await generate.mutateAsync({ topicId: id, stage: "content" });
        toast.success("Plan confirmed — generating drafts. Not published.");
        onPackageUpdated?.();
        return;
      }

      if (primaryKind === "review_drafts") {
        const pending = eligiblePendingOutputs;
        if (pending.length === 0) {
          setEvidenceOpen(true);
          toast.message("No eligible drafts to approve — open Evidence and activity.");
          return;
        }
        setEvidenceOpen(true);
        setFocusOutputId(pending[0].id);
        return;
      }

      if (primaryKind === "approve_distribution") {
        for (const o of pendingOutputs) {
          await setOutputStatus.mutateAsync({
            topicId: id,
            outputId: o.id,
            status: "approved",
          });
        }
        const publishing = mergeSchedulePrefsIntoPublishing(topic?.publishing ?? {}, {
          distribution_ready_at: new Date().toISOString(),
        });
        await upsertStage.mutateAsync({
          topicId: id,
          publishing,
          workflowStatus: "ready_for_publishing",
        });
        toast.success(
          "Approved for distribution — package is channel-ready. Nothing was published yet."
        );
        onPackageUpdated?.();
      }
    } catch (e) {
      toast.error(rpcError(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const ensurePlanGenerated = async () => {
    setBusy(true);
    try {
      const id = await ensureTopic();
      await generate.mutateAsync({ topicId: id, stage: "plan" });
      toast.success("Understanding updated");
      onPackageUpdated?.();
    } catch (e) {
      toast.error(rpcError(e, "Could not update understanding"));
    } finally {
      setBusy(false);
    }
  };

  const uploadPackageImage = async (
    kind: "thumbnail" | "square" | "vertical" | "horizontal",
    file: File | null
  ) => {
    if (!file) return;
    setUploadingKind(kind);
    setBusy(true);
    try {
      const id = await ensureTopic();
      const path = await uploadContentTopicImage({ topicSlug, kind, file });
      const pathKey =
        kind === "square"
          ? "square_path"
          : kind === "thumbnail"
            ? "thumbnail_path"
            : kind === "vertical"
              ? "vertical_path"
              : "horizontal_path";
      const nextFinal = {
        ...finalAssets,
        [pathKey]: path,
        status: "draft",
      };
      await upsertStage.mutateAsync({
        topicId: id,
        creative: {
          ...creative,
          final_assets: nextFinal,
          [pathKey]: path,
        },
      });
      toast.success(`${kind} uploaded`);
      onPackageUpdated?.();
      await detailQuery.refetch();
    } catch (e) {
      toast.error(rpcError(e, "Could not upload image"));
    } finally {
      setUploadingKind(null);
      setBusy(false);
    }
  };

  const researchLabel =
    missingRegions.length > 0 ? `Research ${joinList(missingRegions)}` : "Research missing regions";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Queue
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight leading-snug">{pkg.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {pkg.coverageSummary}
          </p>
        </div>
      </div>

      {needsDecision ? (
        <section className="rounded-xl bg-card/90 shadow-e2 p-4 space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Decision needed
            </p>
            <p className="text-sm font-semibold mt-1">{decisionCopy.title}</p>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              {decisionCopy.reason}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryKind === "resolve_gap" && decisionRegions.length > 0 ? (
              decisionRegions.map((region) => (
                <Button
                  key={region}
                  size="sm"
                  className="shadow-primary-btn border-0"
                  disabled={busy || generating}
                  onClick={() => {
                    if (!openKnowledgeDecision(region)) {
                      toast.message("No open candidate for this package.");
                    }
                  }}
                >
                  Review {region}
                </Button>
              ))
            ) : (
              <Button
                size="sm"
                className="shadow-primary-btn border-0"
                disabled={busy || generating}
                onClick={() => void runPrimary()}
              >
                {(busy || generating) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {decisionCopy.title}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic"
              disabled={busy}
              onClick={onBack}
            >
              Hold
            </Button>
          </div>
        </section>
      ) : generating || watchRunInProgress ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Machine working — no decision needed yet
        </p>
      ) : pkg.prefs.distribution_ready_at ? (
        <p className="text-sm text-muted-foreground">
          Approved for distribution — channel execution is separate
        </p>
      ) : null}

      {!needsDecision && (automaticCopy || missingRegions.length > 0) ? (
        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
          {researchAutomatic ? (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Next automatically
              </p>
              <p className="text-sm font-medium">Researching</p>
              {automaticCopy ? (
                <p className="text-xs text-muted-foreground leading-snug">{automaticCopy}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Last attempt {formatAttempt(lastWatchRun?.started_at)} · Next attempt{" "}
                {watchRunInProgress ? "in progress" : "when Watch next runs"}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Ready to research
              </p>
              {automaticCopy ? (
                <p className="text-xs text-muted-foreground leading-snug">{automaticCopy}</p>
              ) : (
                <p className="text-xs text-muted-foreground leading-snug">
                  Official sources are still needed for {joinList(missingRegions)}.
                </p>
              )}
              <Button
                size="sm"
                className="shadow-primary-btn border-0"
                disabled={busy || generating || researchGaps.isPending}
                onClick={() => void researchMissingRegions()}
              >
                {(busy || researchGaps.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {researchLabel}
              </Button>
            </>
          )}
        </section>
      ) : null}

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setEvidenceOpen((v) => !v)}
        >
          {evidenceOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Evidence and activity
        </button>
        {evidenceOpen ? (
          <div className="mt-3 space-y-4">
            <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
              <h3 className="text-sm font-semibold">Coverage</h3>
              <ul className="space-y-2">
                {reviewerCoverage.map((c) => {
                  const nav = coverageNavTarget(c);
                  const clickable = nav.kind === "knowledge";
                  return (
                    <li key={c.id} className="text-sm space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        {clickable ? (
                          <button
                            type="button"
                            className="font-medium text-left text-primary hover:underline"
                            onClick={() => {
                              if (nav.kind === "knowledge") setFocusKnowledgeId(nav.knowledgeId);
                            }}
                          >
                            {c.label}
                          </button>
                        ) : (
                          <span className="font-medium">{c.label}</span>
                        )}
                        <span className="text-muted-foreground">{coverageStatusLabel(c.status)}</span>
                      </div>
                      {coverageProgressHint(c.status) ? (
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {coverageProgressHint(c.status)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {researchingRegions.length > 0 ? (
                <p className="text-xs text-muted-foreground leading-snug">
                  Filla is looking for {joinList(researchingRegions)}.
                </p>
              ) : null}
            </section>

            {evidenceSignals.length > 0 ? (
              <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Watch evidence</h3>
                <ul className="space-y-3">
                  {evidenceSignals.map((signal) => (
                    <li key={`${signal.type}-${signal.label}`} className="space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{signal.label}</p>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {confidenceLabel(signal.confidence)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {signal.observation}
                      </p>
                      {signal.sourceUrls.length > 0 ? (
                        <ul className="text-xs space-y-0.5">
                          {signal.sourceUrls.map((url) => (
                            <li key={url}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline break-all"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {visibleOutputs.length > 0 ? (
              <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Drafts</h3>
                {visibleOutputs.map((o) => {
                  const drifted = draftDriftedFromSubject(pkg.subjectKey, o);
                  const eligibleReview =
                    planAccepted &&
                    !drifted &&
                    !intlCoverageBlocked &&
                    (o.status === "draft" || o.status === "needs_review");
                  return (
                    <article
                      key={o.id}
                      id={`draft-${o.id}`}
                      className={`rounded-xl bg-muted/20 p-3 space-y-2 ${
                        focusOutputId === o.id ? "ring-2 ring-primary/40" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {outputReviewerLabel(o.output_kind, o.title)}
                        </p>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {drifted || o.status === "rejected"
                            ? "Held"
                            : o.status === "approved"
                              ? "Approved"
                              : o.status === "needs_review" || o.status === "draft"
                                ? "Ready to review"
                                : formKindLabel(o.status)}
                        </span>
                      </div>
                      {editRaw ? (
                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-40 overflow-auto font-mono">
                          {(o.body ?? "").slice(0, 4000)}
                        </pre>
                      ) : (
                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">
                          {draftBodyToReadableProse((o.body ?? "").slice(0, 4000))}
                        </div>
                      )}
                      {eligibleReview ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="shadow-primary-btn border-0 h-8"
                            disabled={busy || setOutputStatus.isPending}
                            onClick={() =>
                              void (async () => {
                                setBusy(true);
                                try {
                                  const id = await ensureTopic();
                                  await setOutputStatus.mutateAsync({
                                    topicId: id,
                                    outputId: o.id,
                                    status: "approved",
                                  });
                                  toast.success("Draft approved");
                                  onPackageUpdated?.();
                                  await detailQuery.refetch();
                                } catch (e) {
                                  toast.error(rpcError(e, "Could not approve draft"));
                                } finally {
                                  setBusy(false);
                                }
                              })()
                            }
                          >
                            Approve draft
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-0 btn-neomorphic h-8"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                setBusy(true);
                                try {
                                  const id = await ensureTopic();
                                  await setOutputStatus.mutateAsync({
                                    topicId: id,
                                    outputId: o.id,
                                    status: "rejected",
                                  });
                                  toast.message("Draft held");
                                  onPackageUpdated?.();
                                } catch (e) {
                                  toast.error(rpcError(e, "Could not hold draft"));
                                } finally {
                                  setBusy(false);
                                }
                              })()
                            }
                          >
                            Hold
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                <button
                  type="button"
                  className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                  onClick={() => setEditRaw((v) => !v)}
                >
                  {editRaw ? "Show readable prose" : "Show raw markdown"}
                </button>
              </section>
            ) : null}

            {imagesUploadUnlocked ? (
              <section id="package-images" className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Images</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["square", "Square", imagePaths.square],
                      ["thumbnail", "Thumbnail", imagePaths.thumbnail],
                      ["vertical", "Vertical", imagePaths.vertical],
                      ["horizontal", "Horizontal", imagePaths.horizontal],
                    ] as const
                  ).map(([kind, label, path]) => {
                    const url = publicContentImageUrl(path);
                    return (
                      <div key={kind} className="rounded-lg bg-card/60 p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">{label}</p>
                          <label
                            className={`text-[11px] cursor-pointer hover:underline ${
                              busy ? "pointer-events-none opacity-50" : "text-primary"
                            }`}
                          >
                            {uploadingKind === kind ? "Uploading…" : path ? "Replace" : "Upload"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={busy}
                              onChange={(e) =>
                                void uploadPackageImage(kind, e.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                        </div>
                        {url ? (
                          <img
                            src={url}
                            alt=""
                            className="h-16 w-16 rounded-md object-cover shadow-sm"
                          />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">No file</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl bg-muted/20 p-3 space-y-2 text-xs">
              <p>
                <span className="font-medium">Verified claims:</span>{" "}
                {claims.filter((c) => String(c.verification_status) === "verified").length}
              </p>
              {seoProposal.primary_keyword ? (
                <p>
                  <span className="font-medium">Search phrase:</span> {seoProposal.primary_keyword}
                </p>
              ) : null}
              {draft.objective.trim() && (planAccepted || primaryKind === "accept_plan") ? (
                <p>
                  <span className="font-medium">Plan objective:</span> {draft.objective}
                </p>
              ) : null}
              {sources.length > 0 ? (
                <ul className="space-y-1">
                  {sources.slice(0, 8).map((s) => (
                    <li key={s.id}>{s.label || s.url || s.id}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-0 btn-neomorphic text-xs"
                  disabled={busy || generating}
                  onClick={() => void ensurePlanGenerated()}
                >
                  Refresh understanding
                </Button>
                {planAccepted ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-0 btn-neomorphic text-xs"
                    disabled={busy || generating || !topicId}
                    onClick={() =>
                      void generate
                        .mutateAsync({ topicId: topicId!, stage: "content", regenerate: true })
                        .then(() => toast.success("Regenerating drafts"))
                        .catch((e) => toast.error(rpcError(e, "Failed")))
                    }
                  >
                    Regenerate drafts
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <AdminKnowledgeDetailSheet
        knowledgeId={focusKnowledgeId}
        open={Boolean(focusKnowledgeId)}
        onOpenChange={(open) => {
          if (!open) {
            setFocusKnowledgeId(null);
            onPackageUpdated?.();
          }
        }}
      />
    </div>
  );
}
