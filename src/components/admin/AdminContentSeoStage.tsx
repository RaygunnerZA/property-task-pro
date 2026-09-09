import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import {
  useAdminApproveContentTopicSeo,
  useAdminGenerateContent,
  useAdminRejectContentTopicSeo,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminContentResolveGrounding } from "@/components/admin/AdminContentResolveGrounding";
import { ContentQueueOvernightButton } from "@/components/admin/ContentQueueOvernightButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  canApproveSeo,
  formatAudienceChipDisplay,
  formatGroundedSummary,
  getSeoReadiness,
  hasSeoProposal,
  isInheritedAudience,
  isInheritedJurisdiction,
  normalizeSeoProposal,
  partitionSeoGrounding,
  type ContentStageEnvelope,
  type GroundingRemedyId,
} from "@/lib/content/contentTopicWorkflow";
import type { ContentTopicWorkflowStatus } from "@/types/knowledge";
import { toast } from "sonner";

function rpcErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message;
  if (msg.includes("seo_source_unavailable")) {
    return "Source content is unavailable. Resolve grounding before approving SEO.";
  }
  if (msg.includes("seo_verification_required")) {
    return "Knowledge gaps or verification checks remain. Resolve them before approving SEO.";
  }
  if (msg.includes("seo_proposal_empty")) {
    return "SEO proposal is empty.";
  }
  return msg || fallback;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function MetaChip({
  children,
  inherited,
  onClick,
}: {
  children: React.ReactNode;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-[6px] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        inherited ? "bg-primary/10 text-foreground" : "bg-muted/60 text-foreground",
        onClick && "hover:bg-muted/80 cursor-pointer"
      )}
    >
      {children}
    </Tag>
  );
}

function EditableQueryChips({
  queries,
  onChange,
}: {
  queries: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const value = draft.trim().replace(/,$/, "");
    if (!value || queries.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...queries, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {queries.map((q) => (
          <span
            key={q}
            className="inline-flex items-center gap-1 rounded-[6px] bg-muted/60 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider"
          >
            {q}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${q}`}
              onClick={() => onChange(queries.filter((item) => item !== q))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addDraft();
          }
        }}
        onBlur={addDraft}
        placeholder="Type a related query and press Enter"
        aria-label="Add related query"
      />
    </div>
  );
}

function GroundingFindingList({
  title,
  items,
  emptyLabel,
  editValue,
  onEditValueChange,
  editing,
  onStartEdit,
  onFinishEdit,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  editValue: string;
  onEditValueChange: (value: string) => void;
  editing: boolean;
  onStartEdit: () => void;
  onFinishEdit: () => void;
}) {
  return (
    <section className="rounded-xl bg-muted/30 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>
          {title}
          {items.length > 0 ? ` · ${items.length}` : ""}
        </FieldLabel>
        {!editing && items.length > 0 ? (
          <button
            type="button"
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            onClick={onStartEdit}
          >
            Edit
          </button>
        ) : null}
        {editing ? (
          <button
            type="button"
            className="text-[10px] font-mono uppercase tracking-wider text-primary hover:underline"
            onClick={onFinishEdit}
          >
            Done
          </button>
        ) : null}
      </div>
      {editing ? (
        <Textarea
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          rows={Math.max(3, items.length + 1)}
          aria-label={`Edit ${title}`}
        />
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-lg bg-background/70 px-2.5 py-1.5 text-xs leading-snug text-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SeoStage({
  topicId,
  envelope,
  workflowStatus,
  busy,
  applicability,
  showResolvePanel,
  onRemedy,
  sourceCount = 0,
  groundingCheckedAt,
}: {
  topicId: string;
  envelope: ContentStageEnvelope;
  workflowStatus: ContentTopicWorkflowStatus;
  busy: boolean;
  applicability?: Record<string, unknown>;
  showResolvePanel?: boolean;
  onRemedy?: (id: GroundingRemedyId) => void;
  sourceCount?: number;
  groundingCheckedAt?: string | null;
}) {
  const generate = useAdminGenerateContent();
  const approve = useAdminApproveContentTopicSeo();
  const reject = useAdminRejectContentTopicSeo();
  const upsert = useAdminUpsertContentTopicStage();
  const proposal = useMemo(() => normalizeSeoProposal(envelope.current ?? {}), [envelope]);

  const [primaryTheme, setPrimaryTheme] = useState(proposal.primary_search_theme);
  const [primaryKeyword, setPrimaryKeyword] = useState(proposal.primary_keyword);
  const [relatedQueries, setRelatedQueries] = useState(proposal.secondary_keywords);
  const [intent, setIntent] = useState(proposal.search_intent);
  const [editingIntent, setEditingIntent] = useState(false);
  const [audience, setAudience] = useState(proposal.target_audience);
  const [problem, setProblem] = useState(proposal.user_problem);
  const [jurisdiction, setJurisdiction] = useState(proposal.jurisdiction);
  const [angle, setAngle] = useState(proposal.content_angle);
  const [gapsText, setGapsText] = useState("");
  const [warningsText, setWarningsText] = useState("");
  const [editingGaps, setEditingGaps] = useState(false);
  const [editingWarnings, setEditingWarnings] = useState(false);
  const [overrideApplicability, setOverrideApplicability] = useState(false);
  const [groundingExpanded, setGroundingExpanded] = useState(false);

  useEffect(() => {
    const next = normalizeSeoProposal(envelope.current ?? {});
    const partitioned = partitionSeoGrounding(next);
    setPrimaryTheme(next.primary_search_theme);
    setPrimaryKeyword(next.primary_keyword);
    setRelatedQueries(next.secondary_keywords);
    setIntent(next.search_intent);
    setAudience(next.target_audience);
    setProblem(next.user_problem);
    setJurisdiction(next.jurisdiction);
    setAngle(next.content_angle);
    setGapsText(partitioned.knowledgeGaps.join("\n"));
    setWarningsText(partitioned.verificationChecks.join("\n"));
    setOverrideApplicability(
      Boolean(next.jurisdiction) && !isInheritedJurisdiction(next.jurisdiction, applicability)
    );
    setEditingGaps(false);
    setEditingWarnings(false);
  }, [envelope, applicability]);

  const liveKnowledgeGaps = gapsText.split("\n").map((s) => s.trim()).filter(Boolean);
  const liveWarnings = warningsText.split("\n").map((s) => s.trim()).filter(Boolean);

  const readiness = useMemo(() => {
    const basePartition = partitionSeoGrounding(proposal);
    const draftEnvelope: ContentStageEnvelope = {
      ...envelope,
      current: {
        ...proposal,
        evidence_gaps: [...basePartition.sourceIssues, ...liveKnowledgeGaps],
        research_warnings: liveWarnings,
      },
    };
    return getSeoReadiness(draftEnvelope);
  }, [envelope, proposal, liveKnowledgeGaps, liveWarnings]);

  const sourceIssues = readiness.sourceIssues;
  const relatedGapCount = liveKnowledgeGaps.length;
  const relatedWarningCount = liveWarnings.length;
  const groundingHealthy = readiness.canApprove || readiness.status === "approved";

  const buildPayload = () => {
    const next = normalizeSeoProposal({
      primary_search_theme: primaryTheme,
      primary_keyword: primaryKeyword,
      secondary_keywords: relatedQueries,
      search_intent: intent,
      target_audience: audience,
      user_problem: problem,
      jurisdiction,
      content_angle: angle,
      source_coverage_summary: proposal.source_coverage_summary,
      evidence_gaps: [...sourceIssues, ...liveKnowledgeGaps],
      research_warnings: liveWarnings,
      source_content_unavailable: readiness.sourceUnavailable,
    });
    return { ...next };
  };

  const saveDraft = () => {
    const next = {
      ...envelope,
      approval_status: envelope.approval_status ?? "pending",
      current: buildPayload(),
    };
    upsert.mutate(
      { topicId, seo: next },
      {
        onSuccess: () => toast.success("SEO changes saved"),
        onError: (e) => toast.error(rpcErrorMessage(e, "Save failed")),
      }
    );
  };

  const hasProposal = Boolean(primaryKeyword.trim() || primaryTheme.trim());
  const approved = envelope.approval_status === "approved";
  const jurisdictionInherited = isInheritedJurisdiction(jurisdiction, applicability);
  const audienceInherited = isInheritedAudience(audience, applicability);
  const activelyGenerating =
    workflowStatus === "generating_seo" && !hasProposal && !envelope.last_error;

  if (!hasProposal && activelyGenerating) {
    return <p className="text-xs text-muted-foreground">Generating SEO proposal…</p>;
  }

  if (!hasProposal) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">No SEO proposal yet.</p>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy || generate.isPending}
          onClick={() =>
            generate.mutate(
              { topicId, stage: "seo" },
              {
                onSuccess: () => toast.success("SEO proposal generated"),
                onError: (e) => toast.error(rpcErrorMessage(e, "SEO generation failed")),
              }
            )
          }
        >
          Generate SEO opportunity
        </Button>
        <ContentQueueOvernightButton topicId={topicId} stage="seo" disabled={busy} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {envelope.stale && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Upstream Knowledge changed — review SEO before continuing.
        </p>
      )}

      {showResolvePanel && onRemedy && !groundingHealthy && (
        <AdminContentResolveGrounding readiness={readiness} busy={busy} onRemedy={onRemedy} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <FieldLabel>SEO</FieldLabel>
            <Input
              className="text-base font-semibold bg-transparent border-0 pl-3 pr-0 h-auto focus-visible:ring-0"
              value={primaryTheme}
              onChange={(e) => setPrimaryTheme(e.target.value)}
              aria-label="Proposed SEO title"
            />
            <div className="flex flex-wrap gap-1.5 items-center">
              {editingIntent ? (
                <Input
                  className="h-7 max-w-[12rem] text-[10px] font-mono uppercase"
                  value={intent}
                  autoFocus
                  onChange={(e) => setIntent(e.target.value)}
                  onBlur={() => setEditingIntent(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingIntent(false);
                  }}
                  aria-label="Search intent"
                />
              ) : intent ? (
                <MetaChip onClick={() => setEditingIntent(true)}>{intent}</MetaChip>
              ) : (
                <MetaChip onClick={() => setEditingIntent(true)}>Set intent</MetaChip>
              )}
              {jurisdiction ? (
                <MetaChip inherited={jurisdictionInherited}>
                  {jurisdiction}
                  {jurisdictionInherited ? " · Knowledge" : ""}
                </MetaChip>
              ) : null}
              {audience ? (
                <MetaChip inherited={audienceInherited}>
                  {formatAudienceChipDisplay(audience, applicability)}
                </MetaChip>
              ) : null}
            </div>
            {(jurisdictionInherited || audienceInherited) && (
              <p className="text-[10px] text-muted-foreground">
                Jurisdiction and audience inherit from linked Knowledge unless overridden.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Target query</FieldLabel>
            <Input
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              aria-label="Target query"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Related queries</FieldLabel>
            <EditableQueryChips queries={relatedQueries} onChange={setRelatedQueries} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Content opportunity</FieldLabel>
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              aria-label="Content opportunity"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Content angle</FieldLabel>
            <Textarea
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              rows={3}
              aria-label="Content angle"
            />
          </div>

          {!overrideApplicability ? (
            <button
              type="button"
              className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => setOverrideApplicability(true)}
            >
              Override jurisdiction or audience
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel>Jurisdiction override</FieldLabel>
                <Input
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  aria-label="Jurisdiction override"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Audience override</FieldLabel>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  aria-label="Audience override"
                />
              </div>
              <button
                type="button"
                className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground sm:col-span-2"
                onClick={() => setOverrideApplicability(false)}
              >
                Use Knowledge defaults
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {groundingHealthy && !groundingExpanded ? (
            <section className="rounded-xl bg-primary/5 shadow-sm p-3 space-y-1">
              <p className="text-sm font-medium flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {formatGroundedSummary({ sourceCount, checkedAt: groundingCheckedAt })}
              </p>
              <button
                type="button"
                className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                onClick={() => setGroundingExpanded(true)}
              >
                Show grounding details
              </button>
            </section>
          ) : (
            <>
              {(readiness.sourceUnavailable || sourceIssues.length > 0) && (
                <section className="rounded-xl bg-amber-500/10 shadow-sm p-3 space-y-2">
                  <FieldLabel>Source issue</FieldLabel>
                  <ul className="space-y-1.5">
                    {sourceIssues.map((issue) => (
                      <li
                        key={issue}
                        className="rounded-lg bg-background/70 px-2.5 py-1.5 text-xs leading-snug flex items-start gap-2"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!readiness.sourceUnavailable && sourceIssues.length === 0 && (
                <section className="rounded-xl bg-muted/30 shadow-sm p-3 space-y-1">
                  <FieldLabel>Source grounding</FieldLabel>
                  <p className="text-sm font-medium flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    Source content available
                  </p>
                  {proposal.source_coverage_summary ? (
                    <p className="text-xs text-muted-foreground">{proposal.source_coverage_summary}</p>
                  ) : null}
                </section>
              )}

              <GroundingFindingList
                title="Knowledge gaps"
                items={liveKnowledgeGaps}
                emptyLabel="No missing facts identified."
                editValue={gapsText}
                onEditValueChange={setGapsText}
                editing={editingGaps}
                onStartEdit={() => setEditingGaps(true)}
                onFinishEdit={() => setEditingGaps(false)}
              />

              <GroundingFindingList
                title="Verification required"
                items={liveWarnings}
                emptyLabel="No verification checks identified."
                editValue={warningsText}
                onEditValueChange={setWarningsText}
                editing={editingWarnings}
                onStartEdit={() => setEditingWarnings(true)}
                onFinishEdit={() => setEditingWarnings(false)}
              />

              {groundingHealthy && (
                <button
                  type="button"
                  className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => setGroundingExpanded(false)}
                >
                  Collapse
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {(envelope.versions?.length ?? 0) > 1 && (
        <p className="text-xs text-muted-foreground">
          {envelope.versions?.length} versions saved — regeneration preserves prior versions.
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {!approved && canApproveSeo({ ...envelope, current: buildPayload() }) && (
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy || approve.isPending}
            onClick={() => {
              const next = { ...envelope, current: buildPayload() };
              approve.mutate(
                { topicId, seo: next },
                {
                  onSuccess: () => toast.success("SEO approved — brief stage unlocked"),
                  onError: (e) => toast.error(rpcErrorMessage(e, "Approval failed")),
                }
              );
            }}
          >
            Approve SEO
          </Button>
        )}
        <Button size="sm" variant="outline" className="border-0 btn-neomorphic text-xs" disabled={busy} onClick={saveDraft}>
          Save changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic text-xs"
          disabled={busy || generate.isPending}
          onClick={() =>
            generate.mutate(
              { topicId, stage: "seo", regenerate: true },
              {
                onSuccess: () => toast.success("SEO regenerated"),
                onError: (e) => toast.error(rpcErrorMessage(e, "Regeneration failed")),
              }
            )
          }
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
        </Button>
        {!approved && (
          <Button
            size="sm"
            variant="outline"
            className="border-0 btn-neomorphic text-xs"
            disabled={busy}
            onClick={() =>
              reject.mutate({ topicId }, { onSuccess: () => toast.success("SEO rejected") })
            }
          >
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}
