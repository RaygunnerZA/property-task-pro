/**
 * Phase 2 progressive Content Tree: Choose topic → Review plan → Review content.
 * Internal format-brief statuses stay in the data model; the UI only surfaces decisions.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import {
  useAdminApproveContentPlan,
  useAdminContentTopic,
  useAdminContentTopics,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminKnowledgeQueue,
  useAdminSetContentOutputStatus,
  useAdminUpsertContentStrategy,
} from "@/hooks/admin/useAdminKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONTENT_SCOPES,
  formKindLabel,
  normalizeParentStrategy,
  planNextAction,
  recommendContentPlan,
  resolveVisibleStage,
  scopeLabel,
  type ContentFormKind,
  type ContentFormatBriefRow,
  type ContentParentStrategy,
  type ContentScope,
} from "@/lib/content/contentPlan";
import { normalizeSeoProposal, normalizeStageEnvelope } from "@/lib/content/contentTopicWorkflow";
import { toast } from "sonner";

function rpcError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  if (e.message.includes("content_topic_exists")) {
    return "A topic already exists for this Knowledge. Open it or allow another angle.";
  }
  return e.message || fallback;
}

export function AdminContentPlanWorkspace() {
  const topicsQuery = useAdminContentTopics();
  const createTopic = useAdminCreateContentTopic();
  const generate = useAdminGenerateContent();
  const upsertStrategy = useAdminUpsertContentStrategy();
  const approvePlan = useAdminApproveContentPlan();
  const setOutputStatus = useAdminSetContentOutputStatus();
  const verifiedQueue = useAdminKnowledgeQueue(["verified", "published"]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkKnowledgeId, setLinkKnowledgeId] = useState("");
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const detailQuery = useAdminContentTopic(selectedId);

  const topic = detailQuery.data?.topic;
  const knowledge = detailQuery.data?.knowledge;
  const outputs = detailQuery.data?.outputs ?? [];
  const formatBriefs = (detailQuery.data?.format_briefs ?? []) as ContentFormatBriefRow[];
  const knowledgeLinks = detailQuery.data?.knowledge_links ?? [];
  const seoEnv = normalizeStageEnvelope(topic?.seo);
  const seoProposal = normalizeSeoProposal(seoEnv.current ?? seoEnv.approved ?? {});

  const strategy = useMemo(() => {
    const base = normalizeParentStrategy(topic?.strategy ?? {});
    if (base.primary_form) return base;
    if (!knowledge) return base;
    const applicability = (knowledge.applicability ?? {}) as {
      jurisdictions?: string[];
      unscoped?: boolean;
    };
    return {
      ...recommendContentPlan({
        channel: topic?.channel ?? "website_blog_social",
        knowledgeTitle: knowledge.title,
        jurisdictions: applicability.jurisdictions ?? [],
        unscoped: applicability.unscoped,
        propertyJurisdictionKnown: false,
        scopeOverride: (topic?.content_scope as ContentScope) || "",
      }),
      ...base,
      content_scope: base.content_scope || (topic?.content_scope as ContentScope) || "",
    };
  }, [topic, knowledge]);

  const [draft, setDraft] = useState<ContentParentStrategy>(strategy);
  useEffect(() => {
    setDraft(strategy);
  }, [strategy]);

  const stage = resolveVisibleStage({
    hasTopic: Boolean(topic),
    strategy: draft,
    formatBriefs,
    outputs,
    workflowStatus: topic?.workflow_status,
  });

  const generating =
    generate.isPending ||
    approvePlan.isPending ||
    createTopic.isPending ||
    topic?.workflow_status === "generating_plan" ||
    topic?.workflow_status === "generating_content";

  const next = planNextAction({
    stage,
    strategy: draft,
    formatBriefs,
    outputs,
    generating,
  });

  const knowledgeOptions = (verifiedQueue.data ?? []).map((k) => ({
    id: k.id,
    title: k.title,
  }));

  const createAndGenerate = async () => {
    if (!linkKnowledgeId) {
      toast.error("Select Knowledge first");
      return;
    }
    try {
      const row = await createTopic.mutateAsync({
        knowledgeId: linkKnowledgeId,
        allowDuplicate,
      });
      setSelectedId(row.id);
      await generate.mutateAsync({ topicId: row.id, stage: "plan" });
      toast.success("Plan generated — review scope and forms");
    } catch (e) {
      toast.error(rpcError(e, "Could not create topic"));
    }
  };

  const regeneratePlan = async () => {
    if (!topic) return;
    try {
      await generate.mutateAsync({
        topicId: topic.id,
        stage: "plan",
        regenerate: true,
        strategyOverrides: {
          content_scope: draft.content_scope,
          primary_form: draft.primary_form,
          derivative_forms: draft.derivative_forms,
        },
      });
      toast.success("Plan regenerated");
    } catch (e) {
      toast.error(rpcError(e, "Plan generation failed"));
    }
  };

  const savePlanDraft = async () => {
    if (!topic) return;
    try {
      await upsertStrategy.mutateAsync({
        topicId: topic.id,
        strategy: { ...draft, approval_status: "pending" },
        contentScope: draft.content_scope,
        channel: draft.channel,
      });
      toast.success("Plan saved");
    } catch (e) {
      toast.error(rpcError(e, "Could not save plan"));
    }
  };

  const approveAndGenerate = async () => {
    if (!topic) return;
    try {
      await upsertStrategy.mutateAsync({
        topicId: topic.id,
        strategy: { ...draft, approval_status: "pending" },
        contentScope: draft.content_scope,
        channel: draft.channel,
      });
      const result = await approvePlan.mutateAsync({
        topicId: topic.id,
        strategy: { ...draft, approval_status: "approved" },
      });
      await generate.mutateAsync({ topicId: topic.id, stage: "content" });
      const blocked = result.blocked_forms?.length ?? 0;
      toast.success(
        blocked > 0
          ? `Generating eligible formats (${blocked} skipped)`
          : "Generating content drafts"
      );
    } catch (e) {
      toast.error(rpcError(e, "Approve and generate failed"));
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Content topics</h2>
        <p className="text-sm text-muted-foreground">
          Choose a topic, review the plan, then approve the generated content. Advanced SEO and
          provenance stay in details.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["choose", "1. Choose topic"],
            ["plan", "2. Review plan"],
            ["content", "3. Review content"],
          ] as const
        ).map(([id, label]) => (
          <span
            key={id}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              stage === id ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
            )}
          >
            {label}
          </span>
        ))}
      </nav>

      {next.blocker && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{next.blocker}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Topics
          </p>
          {(topicsQuery.data ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selectedId === t.id ? "bg-primary/15 text-primary" : "bg-muted/30 hover:bg-muted/50"
              )}
            >
              <span className="line-clamp-2 font-medium">{t.title}</span>
              <span className="mt-0.5 block text-[10px] font-mono uppercase text-muted-foreground">
                {t.content_scope ? scopeLabel(t.content_scope) : t.workflow_status}
              </span>
            </button>
          ))}
          {(topicsQuery.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No topics yet.</p>
          )}
        </aside>

        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-4">
          {stage === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link verified or published Knowledge. We generate the SEO opportunity and parent
                strategy together.
              </p>
              <select
                className="w-full rounded-lg bg-muted/40 px-3 py-2 text-sm"
                value={linkKnowledgeId}
                onChange={(e) => setLinkKnowledgeId(e.target.value)}
              >
                <option value="">Select knowledge…</option>
                {knowledgeOptions.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allowDuplicate}
                  onChange={(e) => setAllowDuplicate(e.target.checked)}
                />
                Allow another angle for the same Knowledge
              </label>
              <Button
                size="sm"
                className="shadow-primary-btn border-0"
                disabled={generating || !linkKnowledgeId}
                onClick={() => void createAndGenerate()}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create topic and generate plan
              </Button>
            </div>
          )}

          {stage === "plan" && topic && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{topic.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Linked Knowledge: {knowledge?.title ?? "—"}
                    {knowledgeLinks.length > 1 ? ` · ${knowledgeLinks.length} Knowledge rows` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-0 btn-neomorphic text-xs"
                  disabled={generating}
                  onClick={() => void regeneratePlan()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate plan
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Content scope
                    {draft.scope_inferred ? " · inferred" : " · override"}
                  </p>
                  <select
                    className="w-full rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    value={draft.content_scope}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        content_scope: e.target.value as ContentScope,
                        scope_inferred: false,
                        exclusions:
                          e.target.value === "property_specific"
                            ? d.exclusions.filter((x) => x.form !== "in_app_tip")
                            : d.exclusions.some((x) => x.form === "in_app_tip")
                              ? d.exclusions
                              : [
                                  ...d.exclusions,
                                  {
                                    form: "in_app_tip",
                                    reason:
                                      "In-app tip excluded until exact property jurisdiction is known",
                                    gap_kind: "not_applicable",
                                  },
                                ],
                      }))
                    }
                  >
                    {CONTENT_SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {scopeLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Audience
                  </p>
                  <Input
                    value={draft.audience}
                    onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Market
                  </p>
                  <Input
                    value={draft.market}
                    onChange={(e) => setDraft((d) => ({ ...d, market: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Primary form
                  </p>
                  <Input
                    value={draft.primary_form ? formKindLabel(draft.primary_form) : ""}
                    readOnly
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Objective
                </p>
                <Textarea
                  rows={2}
                  value={draft.objective}
                  onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Derivatives
                </p>
                <p className="text-sm">
                  {draft.derivative_forms.length
                    ? draft.derivative_forms.map(formKindLabel).join(" · ")
                    : "None"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Supporting content
                </p>
                {draft.supporting_content.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None suggested</p>
                ) : (
                  <ul className="space-y-1">
                    {draft.supporting_content.map((s) => (
                      <li key={s.label} className="text-sm">
                        {s.label}
                        {s.kind ? (
                          <span className="text-muted-foreground"> · {s.kind}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Exclusions
                </p>
                {draft.exclusions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  <ul className="space-y-1">
                    {draft.exclusions.map((e) => (
                      <li key={e.form} className="text-sm">
                        {formKindLabel(e.form)} — {e.reason}
                        <span className="text-muted-foreground"> ({e.gap_kind})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {(draft.source_gaps.length > 0 || seoProposal.evidence_gaps.length > 0) && (
                <div className="rounded-lg bg-amber-500/10 p-3 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Source gaps
                  </p>
                  <ul className="space-y-1 text-xs">
                    {(draft.source_gaps.length
                      ? draft.source_gaps
                      : seoProposal.evidence_gaps.map((text) => ({
                          text,
                          gap_kind: "not_yet_researched" as const,
                        }))
                    ).map((g) => (
                      <li key={g.text}>
                        {g.text}
                        <span className="text-muted-foreground"> · {g.gap_kind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                {advancedOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Advanced SEO & provenance
              </button>
              {advancedOpen && (
                <div className="rounded-lg bg-muted/20 p-3 space-y-2 text-xs">
                  <p>
                    <span className="font-medium">Primary query:</span>{" "}
                    {seoProposal.primary_keyword || "—"}
                  </p>
                  <p>
                    <span className="font-medium">Opportunity:</span>{" "}
                    {seoProposal.opportunity_kind === "search_backed"
                      ? "Search-backed"
                      : "Editorial SEO hypothesis"}
                  </p>
                  <p>
                    <span className="font-medium">Content gap:</span>{" "}
                    {seoProposal.content_gap || seoProposal.content_angle || "—"}
                  </p>
                  {seoProposal.query_clusters.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium">Query clusters</p>
                      {seoProposal.query_clusters.map((c) => (
                        <p key={c.intent + c.label}>
                          {c.label}: {c.queries.join("; ") || "—"}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="shadow-primary-btn border-0"
                  disabled={generating || !draft.content_scope || !draft.primary_form}
                  onClick={() => void approveAndGenerate()}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Approve plan and generate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-0 btn-neomorphic"
                  disabled={generating}
                  onClick={() => void savePlanDraft()}
                >
                  Save plan
                </Button>
              </div>
            </div>
          )}

          {stage === "content" && topic && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Review content</h3>
                <p className="text-xs text-muted-foreground">
                  Approve drafts that look right. Formats with gaps were skipped automatically.
                </p>
              </div>

              {formatBriefs.filter((b) => b.status === "blocked").length > 0 && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Skipped formats
                  </p>
                  {formatBriefs
                    .filter((b) => b.status === "blocked")
                    .map((b) => (
                      <p key={b.id} className="text-xs">
                        {formKindLabel(b.form_kind as ContentFormKind)} —{" "}
                        {String((b.blocker as { reason?: string } | null)?.reason ?? b.gap_kind)}
                      </p>
                    ))}
                </div>
              )}

              {outputs.length === 0 && generating && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating drafts…
                </p>
              )}

              {outputs.map((o) => (
                <article key={o.id} className="rounded-xl bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{o.title || o.output_kind}</p>
                      <p className="text-[10px] font-mono uppercase text-muted-foreground">
                        {o.output_kind} · {o.status}
                      </p>
                    </div>
                    {(o.status === "draft" || o.status === "needs_review") && (
                      <Button
                        size="sm"
                        className="shadow-primary-btn border-0"
                        disabled={setOutputStatus.isPending}
                        onClick={() =>
                          setOutputStatus.mutate(
                            { topicId: topic.id, outputId: o.id, status: "approved" },
                            { onSuccess: () => toast.success("Output approved") }
                          )
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {o.status === "approved" && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Approved
                      </span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">
                    {(o.body ?? "").slice(0, 2500)}
                    {(o.body ?? "").length > 2500 ? "…" : ""}
                  </pre>
                </article>
              ))}

              {outputs.length === 0 && !generating && (
                <p className="text-sm text-muted-foreground">
                  No drafts yet. Use Approve plan and generate from Review plan.
                </p>
              )}
            </div>
          )}

          {!topic && stage !== "choose" && (
            <p className="text-sm text-muted-foreground">Select or create a topic to continue.</p>
          )}
        </section>
      </div>
    </div>
  );
}
