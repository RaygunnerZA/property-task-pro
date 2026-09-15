/**
 * Subject package workspace — What we know · What we are making · Review.
 * One context-sensitive primary action only.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  useAdminApproveContentPlan,
  useAdminContentTopic,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminSetContentOutputStatus,
  useAdminUpsertContentStrategy,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  formKindLabel,
  normalizeParentStrategy,
  recommendContentPlan,
  type ContentParentStrategy,
  type ContentScope,
} from "@/lib/content/contentPlan";
import { normalizeSeoProposal, normalizeStageEnvelope } from "@/lib/content/contentTopicWorkflow";
import {
  mergeSchedulePrefsIntoPublishing,
  type PackagePrimaryKind,
  type SubjectPackage,
} from "@/lib/content/knowledgeSubjectPackage";
import { toast } from "sonner";

function rpcError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  return e.message || fallback;
}

function primaryLabel(kind: PackagePrimaryKind): string {
  switch (kind) {
    case "accept_plan":
      return "Accept plan";
    case "review_drafts":
      return "Review drafts";
    case "resolve_gap":
      return "Resolve gap";
    case "approve_distribution":
      return "Approve distribution";
    case "view":
      return "Done";
    default:
      return "Done";
  }
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

  const [draft, setDraft] = useState<ContentParentStrategy>(strategy);
  useEffect(() => {
    setDraft(strategy);
  }, [strategy]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pilotOpen, setPilotOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  let primaryKind: PackagePrimaryKind = pkg.primaryKind;
  if (generating) primaryKind = "none";
  else if (pendingOutputs.length > 0) primaryKind = "review_drafts";
  else if (planAccepted && outputs.length > 0 && pendingOutputs.length === 0) {
    primaryKind = "approve_distribution";
  } else if (!planAccepted && (draft.primary_form || pkg.primaryKind === "accept_plan")) {
    primaryKind = "accept_plan";
  } else if (pkg.primaryKind === "resolve_gap") {
    primaryKind = "resolve_gap";
  } else if (pkg.prefs.distribution_ready_at) {
    primaryKind = "view";
  } else {
    primaryKind = pkg.primaryKind === "none" ? "none" : pkg.primaryKind;
  }

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

  const runPrimary = async () => {
    setBusy(true);
    try {
      if (primaryKind === "view") {
        onBack();
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
        // Machine continuation — do not leave "ready to generate" as human work
        await generate.mutateAsync({ topicId: id, stage: "content" });
        toast.success("Plan accepted — generating drafts");
        onPackageUpdated?.();
        return;
      }

      if (primaryKind === "resolve_gap") {
        toast.message("Open Details to resolve Knowledge gaps, then return here");
        return;
      }

      if (primaryKind === "review_drafts") {
        toast.message("Review the drafts below, then approve distribution when ready");
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
          "Approved for distribution — ready for a channel. Nothing was published yet."
        );
        onPackageUpdated?.();
        return;
      }

      // review_drafts already handled
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
          <p className="text-xs text-muted-foreground mt-0.5">{pkg.whyNow}</p>
        </div>
      </div>

      {/* What we know */}
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <h3 className="text-sm font-semibold">What we know</h3>
        <ul className="space-y-2">
          {pkg.coverage.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
        {pkg.knowledgeRows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {pkg.knowledgeRows.length} Knowledge record
            {pkg.knowledgeRows.length === 1 ? "" : "s"} in this subject
            {sources.length > 0 ? ` · ${sources.length} source${sources.length === 1 ? "" : "s"}` : ""}
          </p>
        )}
        {(draft.source_gaps.length > 0 || seoProposal.evidence_gaps.length > 0) && (
          <div className="rounded-lg bg-amber-500/10 p-3 space-y-1">
            <p className="text-xs font-medium">Important gaps</p>
            <ul className="text-xs space-y-1">
              {(draft.source_gaps.length
                ? draft.source_gaps.map((g) => g.text)
                : seoProposal.evidence_gaps
              ).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* What we are making */}
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <h3 className="text-sm font-semibold">What we are making</h3>
        <ul className="space-y-2">
          {pkg.deliverables.length === 0 ? (
            <li className="text-sm text-muted-foreground">Assessing opportunity</li>
          ) : (
            pkg.deliverables.map((d) => {
            const live = (() => {
              if (d.id === "images") return d.state;
              const output = outputs.find((o) => {
                if (d.id === "informational_article" || d.id === "regulatory_guide") {
                  return o.output_kind === "core_article";
                }
                return o.output_kind === d.id;
              });
              if (!output) return generating && d.state === "Generating" ? "Generating" : d.state;
              if (output.status === "approved") return "Approved";
              if (output.status === "rejected") return "Held";
              if (output.status === "draft" || output.status === "needs_review") {
                return "Ready to review";
              }
              return d.state;
            })();
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span>{d.label}</span>
                <span className="text-muted-foreground">{live}</span>
              </li>
            );
          })
          )}
        </ul>
      </section>

      {/* Review */}
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Review</h3>
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Plan objective
          </p>
          <Textarea
            rows={2}
            value={draft.objective}
            onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {draft.primary_form
            ? `Primary: ${formKindLabel(draft.primary_form)}`
            : "Primary form will be set when the plan is accepted"}
          {draft.derivative_forms.length
            ? ` · Also: ${draft.derivative_forms.map(formKindLabel).join(", ")}`
            : ""}
        </p>

        {outputs.length === 0 && generating && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating drafts…
          </p>
        )}

        {outputs.map((o) => (
          <article key={o.id} className="rounded-xl bg-muted/20 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{o.title || o.output_kind}</p>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                {o.status === "approved"
                  ? "Approved"
                  : o.status === "needs_review" || o.status === "draft"
                    ? "Ready to review"
                    : o.status === "rejected"
                      ? "Held"
                      : o.status}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-40 overflow-auto">
              {(o.body ?? "").slice(0, 2000)}
              {(o.body ?? "").length > 2000 ? "…" : ""}
            </pre>
          </article>
        ))}

        {outputs.length === 0 && !generating && (
          <p className="text-sm text-muted-foreground">
            {pkg.deliverables.length === 0
              ? "Assessing opportunity — forms appear when the plan is ready."
              : "No drafts yet. Accept the plan and the machine will generate drafts."}
          </p>
        )}

        <div className="rounded-lg bg-muted/20 p-3 text-sm text-muted-foreground">
          Images — not started. Concept grid and formats stay inside this package (Pilot controls).
        </div>
      </section>

      <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 rounded-xl bg-card/95 shadow-e2 p-3">
        {primaryKind !== "view" && primaryKind !== "none" ? (
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy || generating}
            onClick={() => void runPrimary()}
          >
            {(busy || generating) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {primaryLabel(primaryKind)}
          </Button>
        ) : generating ? (
          <p className="text-xs text-muted-foreground self-center flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Machine working — no decision needed yet
          </p>
        ) : (
          <p className="text-xs text-muted-foreground self-center">
            {pkg.prefs.distribution_ready_at
              ? "Approved for distribution — channel execution is separate"
              : "No decision required — machine will continue"}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Details
        </button>
        {detailsOpen && (
          <div className="mt-2 rounded-xl bg-muted/20 p-3 space-y-2 text-xs">
            <p>
              <span className="font-medium">Knowledge rows:</span>{" "}
              {pkg.knowledgeRows.map((r) => r.title).join(" · ") || "—"}
            </p>
            <p>
              <span className="font-medium">Workflow:</span> {topic?.workflow_status ?? "not started"}
            </p>
            <p>
              <span className="font-medium">Claims:</span>{" "}
              {claims.filter((c) => String(c.verification_status) === "verified").length} verified
            </p>
            <p>
              <span className="font-medium">SEO:</span>{" "}
              {seoProposal.opportunity_kind === "search_backed"
                ? "Search-backed"
                : "Editorial hypothesis"}{" "}
              · {seoProposal.primary_keyword || "—"}
            </p>
            <ul className="space-y-1">
              {sources.slice(0, 8).map((s) => (
                <li key={s.id}>{s.label || s.url || s.id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
          onClick={() => setPilotOpen((v) => !v)}
        >
          {pilotOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Pilot controls
        </button>
        {pilotOpen && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-muted/20 p-3">
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic text-xs"
              disabled={busy || generating}
              onClick={() => void ensurePlanGenerated()}
            >
              Refresh understanding
            </Button>
            {planAccepted && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
