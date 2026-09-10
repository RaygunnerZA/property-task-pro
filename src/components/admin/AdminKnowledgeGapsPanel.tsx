import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeRow } from "@/types/knowledge";
import {
  buildKnowledgeCoverageMatrix,
  coverageGapId,
  coverageSummary,
  isResearchableStatus,
  MAX_RESEARCH_GAPS,
  clusterResearchQueue,
  distinctCoverageJurisdictions,
  researchGapIdsFromClusters,
  researchableIdsForJurisdiction,
  researchableIdsForTopic,
  researchGapsFromIds,
  researchQueueFromCoverage,
  type CoverageCellStatus,
} from "@/lib/knowledge/knowledgeCoverage";
import {
  useAdminResearchKnowledgeGaps,
  type KnowledgeGapResearchProgress,
} from "@/hooks/admin/useAdminKnowledge";
import {
  overnightBatchConfirm,
  useAdminSubmitAiBatch,
} from "@/hooks/admin/useAdminAiBatch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function cellTone(status: CoverageCellStatus): string {
  switch (status) {
    case "covered":
      return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10";
    case "partial":
      return "text-amber-800 dark:text-amber-300 bg-amber-500/10";
    default:
      return "text-muted-foreground bg-muted/40";
  }
}

function priorityTone(priority: "high" | "medium" | "low"): string {
  switch (priority) {
    case "high":
      return "text-destructive";
    case "medium":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function progressLabel(progress: KnowledgeGapResearchProgress | null): string | null {
  if (!progress) return null;
  if (progress.phase === "discovering") {
    return `Finding official sources for ${progress.gapCount} gap${progress.gapCount === 1 ? "" : "s"}…`;
  }
  if (progress.phase === "fetching") {
    return `Fetching source ${progress.index} of ${progress.total}…`;
  }
  return `Adding ${progress.candidateCount} candidate${progress.candidateCount === 1 ? "" : "s"} to Review…`;
}

function toggleIds(current: Set<string>, ids: string[]): Set<string> {
  const next = new Set(current);
  const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
  if (allSelected) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

type Props = {
  rows: KnowledgeRow[];
};

export function AdminKnowledgeGapsPanel({ rows }: Props) {
  const matrix = useMemo(() => buildKnowledgeCoverageMatrix(rows), [rows]);
  const summary = useMemo(() => coverageSummary(matrix), [matrix]);
  const queue = useMemo(
    () =>
      clusterResearchQueue(researchQueueFromCoverage(matrix)).slice(0, 40),
    [matrix]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<KnowledgeGapResearchProgress | null>(null);
  const research = useAdminResearchKnowledgeGaps();
  const submitBatch = useAdminSubmitAiBatch();

  const distinctJurisdictions = useMemo(
    () => distinctCoverageJurisdictions(matrix.jurisdictions),
    [matrix]
  );
  const displayJurisdictions = distinctJurisdictions.slice(0, 12);
  const displayTopics = matrix.topics.slice(0, 24);
  const busy = research.isPending || submitBatch.isPending;
  const selectedCount = selectedIds.size;
  const researchCount = Math.min(selectedCount, MAX_RESEARCH_GAPS);

  const runResearch = useCallback(
    async (ids: Iterable<string>) => {
      const gaps = researchGapsFromIds(matrix, ids).slice(0, MAX_RESEARCH_GAPS);
      if (!gaps.length) {
        toast.error("Select missing or partial cells first");
        return;
      }
      if (gaps.length > 1) {
        if (!overnightBatchConfirm("research", gaps.length)) return;
        try {
          const res = await submitBatch.mutateAsync({
            capability: "knowledge_gap_research",
            mode: "research",
            gaps,
          });
          toast.success(
            `Queued overnight discovery for ${res.item_count} gap${res.item_count === 1 ? "" : "s"}. Sources land in Review after Gemini finishes — leave Knowledge open or come back later to fetch URLs.`
          );
          setSelectedIds(new Set());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not queue overnight research");
        }
        return;
      }
      setProgress({ phase: "discovering", gapCount: gaps.length });
      try {
        const result = await research.mutateAsync({
          gaps,
          onProgress: setProgress,
        });
        const extra = [
          result.uncoveredGapIds.length
            ? `${result.uncoveredGapIds.length} still uncovered`
            : null,
          result.failedSources.length
            ? `${result.failedSources.length} source${result.failedSources.length === 1 ? "" : "s"} failed to import`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        toast.success(
          extra
            ? `Added ${result.createdCount} candidate${result.createdCount === 1 ? "" : "s"} to Review · ${extra}`
            : `Added ${result.createdCount} candidate${result.createdCount === 1 ? "" : "s"} to Review`
        );
        setSelectedIds(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Research failed");
      } finally {
        setProgress(null);
      }
    },
    [matrix, research, submitBatch]
  );

  const onCellClick = (id: string, event: MouseEvent) => {
    if (busy) return;
    if (event.metaKey || event.ctrlKey || selectedIds.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    void runResearch([id]);
  };

  const queueResearchLabel =
    selectedCount > 0
      ? `Research ${researchCount} selected`
      : `Begin research queue`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-medium text-sm">Gaps</h2>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Coverage of what Filla already knows versus what is missing. Hover Missing or Partial
          for <span className="text-foreground/80">+ Research</span>, or click a topic or
          jurisdiction to select a row or column. One discovery pass finds official URLs; each
          unique URL is fetched once and lands in Review — never auto-published. Bulk research
          uses overnight Gemini Batch (half price); a single cell still runs now.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="Topics" value={summary.topics} />
        <Chip label="Jurisdictions" value={summary.jurisdictions} />
        <Chip label="Covered cells" value={summary.covered} />
        <Chip label="Partial" value={summary.partial} />
        <Chip label="Missing" value={summary.missing} />
      </div>

      {displayTopics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Knowledge rows yet — Add sources first, then coverage appears here.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2 min-h-9">
            {selectedCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedCount} selected
                  {selectedCount > MAX_RESEARCH_GAPS
                    ? ` · first ${MAX_RESEARCH_GAPS} this run`
                    : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs border-0 shadow-primary-btn"
                  disabled={busy}
                  onClick={() => void runResearch(selectedIds)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  + Research {researchCount}
                </Button>
              </>
            )}
          </div>
          {progress && (
            <p className="text-xs text-muted-foreground text-right">{progressLabel(progress)}</p>
          )}
          <div className="min-w-0 overflow-x-auto rounded-xl bg-card/80 shadow-e1">
            <table className="w-full text-left text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="p-3 font-mono uppercase tracking-wider text-[10px] text-muted-foreground sticky left-0 bg-card/95">
                    Topic
                  </th>
                  {displayJurisdictions.map((j) => {
                    const colIds = researchableIdsForJurisdiction(matrix, j, displayTopics);
                    const colSelected = colIds.length > 0 && colIds.every((id) => selectedIds.has(id));
                    return (
                      <th key={j} className="p-2">
                        <button
                          type="button"
                          disabled={busy || colIds.length === 0}
                          onClick={() => setSelectedIds((prev) => toggleIds(prev, colIds))}
                          className={cn(
                            "font-mono uppercase tracking-wider text-[10px] whitespace-nowrap rounded-md px-1.5 py-1 -mx-1.5",
                            colIds.length === 0
                              ? "text-muted-foreground"
                              : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                            colSelected && "bg-primary/15 text-foreground"
                          )}
                          aria-pressed={colSelected}
                          title={
                            colIds.length === 0
                              ? j
                              : `Select all missing and partial in ${j}`
                          }
                        >
                          {j}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayTopics.map((topic) => {
                  const rowIds = researchableIdsForTopic(matrix, topic.key, displayJurisdictions);
                  const rowSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
                  return (
                    <tr key={topic.key} className="border-b border-border/20">
                      <td className="p-2 sticky left-0 bg-card/95 max-w-[14rem]">
                        <button
                          type="button"
                          disabled={busy || rowIds.length === 0}
                          onClick={() => setSelectedIds((prev) => toggleIds(prev, rowIds))}
                          className={cn(
                            "text-left font-medium line-clamp-2 rounded-md px-1.5 py-1 -mx-0.5 w-full",
                            rowIds.length === 0
                              ? "text-foreground"
                              : "hover:bg-primary/10",
                            rowSelected && "bg-primary/15"
                          )}
                          aria-pressed={rowSelected}
                          title={`Select all missing and partial for ${topic.label}`}
                        >
                          {topic.label}
                        </button>
                      </td>
                      {displayJurisdictions.map((j) => {
                        const cell = matrix.cells[topic.key]?.[j] ?? {
                          status: "missing" as const,
                          label: "Missing",
                          knowledgeIds: [],
                        };
                        const id = coverageGapId(topic.key, j);
                        const researchable = isResearchableStatus(cell.status);
                        const selected = selectedIds.has(id);
                        return (
                          <td key={j} className="p-2">
                            {researchable ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => onCellClick(id, event)}
                                aria-pressed={selected}
                                aria-label={
                                  selected
                                    ? `Deselect ${topic.label} in ${j}`
                                    : `Research ${topic.label} in ${j}`
                                }
                                className={cn(
                                  "group inline-flex min-h-[28px] min-w-[4.75rem] items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                                  selected
                                    ? "bg-primary/15 text-foreground shadow-sm"
                                    : cellTone(cell.status),
                                  "hover:bg-primary/20 hover:text-foreground"
                                )}
                              >
                                {selected ? (
                                  <>
                                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
                                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                    </span>
                                    <span>{cell.label}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="group-hover:hidden group-focus-visible:hidden">
                                      {cell.label}
                                    </span>
                                    <span className="hidden font-semibold group-hover:inline group-focus-visible:inline">
                                      + Research
                                    </span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex rounded-md px-2 py-1 text-[11px]",
                                  cellTone(cell.status)
                                )}
                              >
                                {cell.label}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(matrix.topics.length > displayTopics.length ||
              distinctJurisdictions.length > displayJurisdictions.length) && (
              <p className="p-3 text-[11px] text-muted-foreground border-t border-border/30">
                Showing {displayTopics.length} of {matrix.topics.length} topics ·{" "}
                {displayJurisdictions.length} of {distinctJurisdictions.length} jurisdictions
              </p>
            )}
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Research queue
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Prioritised topics. Begin research uses the current selection, or the next topics
              up to {MAX_RESEARCH_GAPS} cells. Related jurisdictions share one source search.
            </p>
          </div>
          {queue.length > 0 && (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs border-0 shadow-primary-btn"
              disabled={busy}
              onClick={() =>
                void runResearch(
                  selectedCount > 0
                    ? selectedIds
                    : researchGapIdsFromClusters(queue, MAX_RESEARCH_GAPS)
                )
              }
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {queueResearchLabel}
            </Button>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open gaps in the current matrix.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((cluster) => {
              const gapIds = cluster.items.map((item) => item.id);
              const selected =
                gapIds.length > 0 && gapIds.every((id) => selectedIds.has(id));
              return (
                <li key={cluster.topicKey}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedIds((prev) => toggleIds(prev, gapIds))}
                    aria-pressed={selected}
                    className={cn(
                      "w-full text-left rounded-xl bg-card/80 shadow-e1 p-3 space-y-1 transition-colors",
                      selected && "bg-primary/10"
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      {selected && (
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[10px] font-mono uppercase tracking-wider",
                          priorityTone(cluster.priority)
                        )}
                      >
                        {cluster.priority} priority
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {cluster.topic}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cluster.items.map((item) => item.jurisdiction).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{cluster.reason}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-card/80 shadow-e1 px-3 py-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
