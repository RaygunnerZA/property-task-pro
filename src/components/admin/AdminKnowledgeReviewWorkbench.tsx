import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Filter, Loader2, MoreHorizontal, Search, X } from "lucide-react";
import {
  useAdminApplyDeterministicGuidance,
  useAdminExtractKnowledgeClaims,
  useAdminGenerateKnowledgeGuidance,
  useAdminKnowledgeDetail,
  useAdminRunKnowledgeCritic,
  useAdminSetDraftGuidance,
  useAdminSetKnowledgeStatus,
  type KnowledgeSourceRow,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminKnowledgeReviewExpanded } from "@/components/admin/AdminKnowledgeReviewExpanded";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";
import {
  attrString,
  computeSourceHealth,
  legalClassificationLabel,
  parseCriticSummary,
  triggerLabel,
  type TrustCheckStatus,
} from "@/lib/knowledge/knowledgePresentation";
import {
  automatedCheckCompletion,
  buildReviewTrustChecks,
  compactBlockers,
  computeReviewToolbarCounts,
  displayCanonicalGuidance,
  displayJurisdiction,
  deriveClassificationLabel,
  deriveTriggerType,
  guidanceProvenanceChip,
  guidanceQualityLabel,
  hasCanonicalGuidance,
  isEligibleForGuidanceGeneration,
  isEligibleForGuidanceImprovement,
  matchesReviewFilter,
  matchesReviewQueue,
  prefersDeterministicGuidance,
  primaryActionForRow,
  reviewBlockingChecks,
  sortReviewRows,
  type ReviewFilterId,
  type ReviewQueueId,
  type ReviewSortId,
} from "@/lib/knowledge/knowledgeReviewState";
import { toast } from "sonner";

function checkTone(status: TrustCheckStatus): string {
  switch (status) {
    case "passed":
      return "text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "text-destructive";
    case "required":
    case "not_run":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function gateErrorMessage(msg: string): string {
  if (msg.includes("guidance_required")) return "Guidance is missing or invalid";
  if (msg.includes("authoritative_source_required")) {
    return "An authoritative source URL is required";
  }
  if (msg.includes("critic_required")) return "Critic must pass before this action";
  if (msg.includes("verify_before_publish")) return "Verify this item before publishing";
  return msg;
}

const ADVANCED_FILTERS: { id: ReviewFilterId; label: string; group: string }[] = [
  { id: "guidance_missing", label: "Guidance missing", group: "Guidance" },
  { id: "guidance_needs_improvement", label: "Guidance needs work", group: "Guidance" },
  { id: "guidance_meaningful", label: "Guidance draft ready", group: "Guidance" },
  { id: "classification_missing", label: "Classification missing", group: "Classification" },
  { id: "source_missing", label: "Source missing", group: "Source" },
  { id: "applicability_incomplete", label: "Applicability incomplete", group: "Applicability" },
  { id: "critic_not_run", label: "Critic not run", group: "Critic" },
  { id: "critic_stale", label: "Critic stale", group: "Critic" },
  { id: "critic_failed", label: "Critic failed", group: "Critic" },
  { id: "ready_for_human", label: "Ready for human verification", group: "Critic" },
];

const QUEUES: { id: ReviewQueueId; label: string }[] = [
  { id: "needs_work", label: "Needs work" },
  { id: "awaiting_critic", label: "Awaiting critic" },
  { id: "ready_to_verify", label: "Ready to verify" },
];

type Props = {
  rows: KnowledgeRow[];
  sourcesByKnowledge: Map<string, KnowledgeSourceRow[]>;
  isLoading: boolean;
  onOpen: (id: string) => void;
};

export function AdminKnowledgeReviewWorkbench({
  rows,
  sourcesByKnowledge,
  isLoading,
  onOpen,
}: Props) {
  const setStatus = useAdminSetKnowledgeStatus();
  const generateGuidance = useAdminGenerateKnowledgeGuidance();
  const applyDeterministic = useAdminApplyDeterministicGuidance();
  const runCritic = useAdminRunKnowledgeCritic();
  const extractClaims = useAdminExtractKnowledgeClaims();
  const setDraft = useAdminSetDraftGuidance();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedDetail = useAdminKnowledgeDetail(expandedId);
  const [queue, setQueue] = useState<ReviewQueueId>("needs_work");
  const [filter, setFilter] = useState<ReviewFilterId | null>(null);
  const [sort, setSort] = useState<ReviewSortId>("fewest_blockers");
  const [search, setSearch] = useState("");
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  const rowModels = useMemo(() => {
    return rows.map((row) => {
      const sources = sourcesByKnowledge.get(row.id) ?? [];
      const checks = buildReviewTrustChecks(row, { sources });
      const blockers = reviewBlockingChecks(checks, row.status);
      const jurisdiction = displayJurisdiction(row);
      const critic = parseCriticSummary(row, undefined, { sources });
      return {
        row,
        sources,
        checks,
        blockers,
        blockerCount: blockers.length,
        jurisdiction,
        eligibleGenerate: isEligibleForGuidanceGeneration(row, sources),
        eligibleImprove: isEligibleForGuidanceImprovement(row, sources),
        primary: primaryActionForRow(row, checks, sources),
        auto: automatedCheckCompletion(checks),
        compact: compactBlockers(checks, row.status),
        health: computeSourceHealth(sources, row),
        critic,
        qualityLabel: guidanceQualityLabel(row),
        provenanceChip: guidanceProvenanceChip(row),
        classification:
          deriveClassificationLabel(row) || legalClassificationLabel(row),
        trigger: deriveTriggerType(row)?.replace(/_/g, "-") || triggerLabel(row),
      };
    });
  }, [rows, sourcesByKnowledge]);

  const eligibleGenerateIds = useMemo(
    () => rowModels.filter((m) => m.eligibleGenerate).map((m) => m.row.id),
    [rowModels]
  );
  const eligibleImproveIds = useMemo(
    () => rowModels.filter((m) => m.eligibleImprove).map((m) => m.row.id),
    [rowModels]
  );
  const eligibleCriticIds = useMemo(
    () =>
      rowModels
        .filter(
          (m) =>
            m.row.status === "candidate" &&
            hasCanonicalGuidance(m.row) &&
            (m.critic.status === "not_run" || m.critic.status === "stale")
        )
        .map((m) => m.row.id),
    [rowModels]
  );

  const toolbarCounts = useMemo(
    () => computeReviewToolbarCounts(rows, sourcesByKnowledge),
    [rows, sourcesByKnowledge]
  );

  const filteredSorted = useMemo(() => {
    let list = rowModels.filter((m) =>
      matchesReviewQueue(queue, m.row, m.checks, m.sources)
    );
    if (filter) {
      list = list.filter((m) =>
        matchesReviewFilter(filter, m.row, m.checks, m.sources)
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const hay = `${m.row.title} ${displayCanonicalGuidance(m.row)} ${m.jurisdiction}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return sortReviewRows(list, sort);
  }, [rowModels, queue, filter, sort, search]);

  const allSelected =
    filteredSorted.length > 0 &&
    filteredSorted.every((m) => selected.has(m.row.id));
  const selectedGenerate = [...selected].filter((id) =>
    eligibleGenerateIds.includes(id)
  );
  const selectedImprove = [...selected].filter((id) =>
    eligibleImproveIds.includes(id)
  );
  const selectedCritic = [...selected].filter((id) =>
    eligibleCriticIds.includes(id)
  );
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredSorted.map((m) => m.row.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatus = (id: string, status: KnowledgeStatus) => {
    setStatus.mutate(
      { knowledgeId: id, status },
      {
        onSuccess: () =>
          toast.success(
            status === "verified"
              ? "Verified — ready to publish"
              : status === "archived"
                ? "Rejected"
                : status === "candidate"
                  ? "Returned to review"
                  : `Status → ${status}`
          ),
        onError: (e) => {
          toast.error(gateErrorMessage(e instanceof Error ? e.message : "Update failed"));
        },
      }
    );
  };

  const confirmGenerate = (
    ids: string[],
    mode: "generate" | "improve" = "generate",
    opts?: { persist?: boolean; intoDraftField?: boolean }
  ) => {
    if (ids.length === 0) {
      toast.message(
        mode === "improve"
          ? "No candidates need guidance improvement"
          : "No candidates need guidance generation"
      );
      return;
    }
    const persist = opts?.persist !== false;
    const deterministic =
      mode === "generate"
        ? ids.filter((id) => {
            const row = rows.find((r) => r.id === id);
            return row && prefersDeterministicGuidance(row);
          })
        : [];
    const aiCount = ids.length - deterministic.length;
    const confirmed = window.confirm(
      [
        mode === "improve"
          ? `Improve guidance for ${ids.length} candidate${ids.length === 1 ? "" : "s"}?`
          : `Generate guidance for ${ids.length} candidate${ids.length === 1 ? "" : "s"}?`,
        deterministic.length
          ? `· ${deterministic.length} can use deterministic imported text (no AI)`
          : null,
        aiCount > 0 ? `· Estimated AI operations: ${aiCount}` : "· Estimated AI operations: 0",
        "",
        persist
          ? "Drafts remain unverified. Nothing will be verified or published."
          : "Proposed text will be placed in the draft field — save to keep it.",
      ]
        .filter((line) => line !== null)
        .join("\n")
    );
    if (!confirmed) return;

    const runAi = (remaining: string[]) => {
      if (remaining.length === 0) {
        toast.success("Draft guidance applied (unverified)");
        return;
      }
      generateGuidance.mutate(
        {
          knowledgeIds: remaining,
          mode,
          persist,
        },
        {
          onSuccess: (res) => {
            if (!persist || opts?.intoDraftField) {
              for (const r of res.results) {
                if (r.ok && r.summary) {
                  setDraftEdits((prev) => ({ ...prev, [r.id]: r.summary! }));
                }
              }
              toast.success(
                "AI-proposed draft placed in the editor — save to keep it (still unverified)"
              );
              return;
            }
            toast.success(
              `${mode === "improve" ? "Improved" : "Generated"} draft guidance for ${res.generated} of ${remaining.length} (still unverified)`
            );
          },
          onError: (e) =>
            toast.error(e instanceof Error ? e.message : "Guidance generation failed"),
        }
      );
    };

    if (deterministic.length > 0 && persist) {
      applyDeterministic.mutate(deterministic, {
        onSuccess: (res) => {
          toast.success(`Backfilled ${res.updated} from imported fields`);
          runAi(ids.filter((id) => !deterministic.includes(id)));
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Deterministic backfill failed");
          runAi(ids);
        },
      });
    } else {
      runAi(ids);
    }
  };

  const runPrimary = (model: (typeof rowModels)[0]) => {
    const { kind } = model.primary;
    if (kind === "generate") {
      confirmGenerate([model.row.id], "generate", {
        persist: false,
        intoDraftField: true,
      });
      setExpandedId(model.row.id);
      return;
    }
    if (kind === "improve") {
      confirmGenerate([model.row.id], "improve", {
        persist: false,
        intoDraftField: true,
      });
      setExpandedId(model.row.id);
      return;
    }
    if (kind === "run_critic") {
      runCritic.mutate(model.row.id, {
        onSuccess: () => toast.success("Critic finished"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Critic failed"),
      });
      return;
    }
    if (kind === "verify") {
      handleStatus(model.row.id, "verified");
      return;
    }
    setExpandedId((cur) => (cur === model.row.id ? null : model.row.id));
  };

  const saveDraft = (id: string) => {
    const text = (draftEdits[id] ?? "").trim();
    if (text.length < 12) {
      toast.error("Guidance must be meaningful prose");
      return;
    }
    setDraft.mutate(
      { knowledgeId: id, summary: text },
      {
        onSuccess: () => {
          toast.success("Draft guidance saved — critic is not run for this version");
          setDraftEdits((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
      }
    );
  };

  const batchRunCritic = (ids: string[]) => {
    if (ids.length === 0) {
      toast.message("No selected records are eligible for critic");
      return;
    }
    if (
      !window.confirm(
        `Run critic for ${ids.length} selected record${ids.length === 1 ? "" : "s"}? Nothing will be verified.`
      )
    ) {
      return;
    }
    void (async () => {
      let ok = 0;
      for (const id of ids) {
        try {
          await runCritic.mutateAsync(id);
          ok += 1;
        } catch {
          /* continue */
        }
      }
      toast.success(`Critic finished for ${ok} of ${ids.length}`);
    })();
  };

  const th =
    "px-2 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate";
  const td = "px-2 py-2.5 text-xs align-top";
  const perforated =
    "border-b border-dashed border-border/50 [border-image:repeating-linear-gradient(90deg,hsl(var(--border))_0_6px,transparent_6px_12px)_1]";

  function stepsSummary(model: (typeof rowModels)[number]): {
    line: string;
    tone: TrustCheckStatus;
  } {
    const criticStatus = model.critic.status;
    const criticBit =
      criticStatus === "passed"
        ? "Critic ok"
        : criticStatus === "failed"
          ? "Critic failed"
          : criticStatus === "stale"
            ? "Critic stale"
            : "Critic not run";
    if (model.blockerCount === 0 && criticStatus === "passed") {
      return { line: `Ready · ${criticBit}`, tone: "passed" };
    }
    if (model.blockerCount === 0) {
      return {
        line: criticBit,
        tone: criticStatus === "failed" ? "failed" : "not_run",
      };
    }
    return {
      line: `${model.blockerCount} open · ${criticBit}`,
      tone: criticStatus === "failed" ? "failed" : "incomplete",
    };
  }

  const busy =
    generateGuidance.isPending ||
    applyDeterministic.isPending ||
    runCritic.isPending ||
    setStatus.isPending ||
    setDraft.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {QUEUES.map((q) => {
            const count =
              q.id === "needs_work"
                ? toolbarCounts.needsWork
                : q.id === "awaiting_critic"
                  ? toolbarCounts.awaitingCritic
                  : toolbarCounts.readyForVerification;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setQueue(q.id)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs border-0",
                  queue === q.id
                    ? "bg-primary/20 text-foreground shadow-sm font-medium"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                )}
              >
                {q.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-8 w-40 pl-7 text-xs border-0 bg-muted/50"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "border-0 btn-neomorphic h-8",
                  filter && "bg-primary/15"
                )}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
                {filter ? " · 1" : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2 space-y-2">
              <p className="text-[10px] font-mono uppercase text-muted-foreground px-1">
                Advanced filters
              </p>
              {ADVANCED_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter((cur) => (cur === f.id ? null : f.id))}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-xs",
                    filter === f.id
                      ? "bg-primary/20 text-foreground"
                      : "hover:bg-muted/60 text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide opacity-70">
                    {f.group}
                  </span>
                  <span className="block">{f.label}</span>
                </button>
              ))}
              {filter && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs"
                  onClick={() => setFilter(null)}
                >
                  Clear filter
                </Button>
              )}
            </PopoverContent>
          </Popover>
          <label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
            Sort
            <select
              className="rounded-md bg-muted/50 px-2 py-1 text-xs text-foreground"
              value={sort}
              onChange={(e) => setSort(e.target.value as ReviewSortId)}
            >
              <option value="fewest_blockers">Fewest blockers</option>
              <option value="newest">Newest candidate</option>
              <option value="jurisdiction">Jurisdiction</option>
            </select>
          </label>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 shadow-sm">
          <span className="text-xs font-medium">{selected.size} selected</span>
          {selectedImprove.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic h-7 text-xs"
              disabled={busy}
              onClick={() =>
                confirmGenerate(selectedImprove, "improve", {
                  persist: false,
                  intoDraftField: true,
                })
              }
            >
              Improve guidance
              {selectedImprove.length < selected.size
                ? ` (${selectedImprove.length} of ${selected.size} eligible)`
                : ""}
            </Button>
          )}
          {selectedGenerate.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic h-7 text-xs"
              disabled={busy}
              onClick={() =>
                confirmGenerate(selectedGenerate, "generate", {
                  persist: false,
                  intoDraftField: true,
                })
              }
            >
              Generate guidance
              {selectedGenerate.length < selected.size
                ? ` (${selectedGenerate.length} of ${selected.size} eligible)`
                : ""}
            </Button>
          )}
          {selectedCritic.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic h-7 text-xs"
              disabled={busy}
              onClick={() => batchRunCritic(selectedCritic)}
            >
              Run critic
              {selectedCritic.length < selected.size
                ? ` (${selectedCritic.length} of ${selected.size} eligible)`
                : ""}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-0 btn-neomorphic h-7 text-xs"
              >
                More…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  const ids = [...selected];
                  if (
                    !window.confirm(
                      `Reject ${ids.length} selected record${ids.length === 1 ? "" : "s"}?`
                    )
                  ) {
                    return;
                  }
                  for (const id of ids) {
                    handleStatus(id, "archived");
                  }
                  setSelected(new Set());
                }}
              >
                Reject selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelected(new Set())}>
                Clear selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="ml-auto text-muted-foreground p-1"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && filteredSorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No items match.</p>
      )}

      {!isLoading && filteredSorted.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl bg-card/80 shadow-e1">
            <table className="w-full text-left border-collapse table-fixed min-w-[960px]">
              <colgroup>
                <col className="w-8" />
                <col className="w-[22%]" />
                <col className="w-[11%]" />
                <col className="w-[24%]" />
                <col className="w-[7%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/40">
                  <th className={th}>
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className={th}>Title</th>
                  <th className={th} title="Jurisdiction">
                    Jurisdiction
                  </th>
                  <th className={th} title="Applies when">
                    Applies when
                  </th>
                  <th className={th} title="Guidance">
                    Guid.
                  </th>
                  <th className={th} title="Classification">
                    Class.
                  </th>
                  <th className={th} title="Open steps and critic">
                    Steps
                  </th>
                  <th className={th}>Next</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((model) => {
                  const { row } = model;
                  const expanded = expandedId === row.id;
                  const editValue =
                    draftEdits[row.id] ??
                    (row.summary?.trim() || row.body?.trim() || "");
                  const steps = stepsSummary(model);

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          "hover:bg-muted/25",
                          expanded ? "bg-muted/15 border-b-0" : perforated
                        )}
                      >
                        <td className={td}>
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Select ${row.title}`}
                          />
                        </td>
                        <td className={td}>
                          <button
                            type="button"
                            className={cn(
                              "text-left text-foreground hover:underline",
                              expanded ? "font-semibold text-sm" : "font-medium"
                            )}
                            onClick={() =>
                              setExpandedId((c) => (c === row.id ? null : row.id))
                            }
                          >
                            {row.title}
                          </button>
                          <p className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">
                            {row.status}
                          </p>
                        </td>
                        <td
                          className={cn(
                            td,
                            model.jurisdiction === "Jurisdiction missing"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <span className="line-clamp-2">{model.jurisdiction}</span>
                        </td>
                        <td className={cn(td, "text-muted-foreground whitespace-normal")}>
                          <span className="line-clamp-3">
                            {attrString(row.attributes, "applies_when") || "—"}
                          </span>
                        </td>
                        {expanded ? (
                          <td className={td} colSpan={4} aria-hidden />
                        ) : (
                          <>
                            <td className={td}>
                              <span className="text-[11px] font-medium text-foreground">
                                {model.qualityLabel}
                              </span>
                            </td>
                            <td className={cn(td, "text-muted-foreground")}>
                              <span className="line-clamp-2">{model.classification}</span>
                              <p className="text-[10px] mt-0.5 opacity-80 line-clamp-1">
                                {model.trigger}
                              </p>
                            </td>
                            <td className={td}>
                              <button
                                type="button"
                                className="text-left w-full"
                                onClick={() => setExpandedId(row.id)}
                              >
                                <span className={cn("text-[11px]", checkTone(steps.tone))}>
                                  {steps.line}
                                </span>
                                {model.compact.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                    {model.compact.map((b) => b.shortName).join(" · ")}
                                  </p>
                                )}
                              </button>
                            </td>
                            <td className={td}>
                              <div className="flex items-start gap-1">
                                <Button
                                  size="sm"
                                  className="shadow-primary-btn border-0 h-7 text-xs flex-1"
                                  disabled={busy}
                                  onClick={() => runPrimary(model)}
                                >
                                  {model.primary.label}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-0 btn-neomorphic h-7 w-7 px-0"
                                      aria-label="More actions"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                                    {model.eligibleGenerate && (
                                      <DropdownMenuItem
                                        disabled={busy}
                                        onClick={() =>
                                          confirmGenerate([row.id], "generate", {
                                            persist: false,
                                            intoDraftField: true,
                                          })
                                        }
                                      >
                                        Generate guidance
                                      </DropdownMenuItem>
                                    )}
                                    {model.eligibleImprove && (
                                      <DropdownMenuItem
                                        disabled={busy}
                                        onClick={() =>
                                          confirmGenerate([row.id], "improve", {
                                            persist: false,
                                            intoDraftField: true,
                                          })
                                        }
                                      >
                                        Improve guidance
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => onOpen(row.id)}>
                                      Open detail
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setExpandedId((c) => (c === row.id ? null : row.id))
                                      }
                                    >
                                      Expand row
                                    </DropdownMenuItem>
                                    {(row.status === "candidate" ||
                                      row.status === "verified") && (
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                          handleStatus(
                                            row.id,
                                            row.status === "verified"
                                              ? "candidate"
                                              : "archived"
                                          )
                                        }
                                      >
                                        {row.status === "verified"
                                          ? "Return to review"
                                          : "Reject"}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                      {expanded && (
                        <tr className={cn(perforated, "bg-transparent")}>
                          <td colSpan={8} className="p-0">
                            <AdminKnowledgeReviewExpanded
                              model={model}
                              editValue={editValue}
                              onEditChange={(value) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [row.id]: value,
                                }))
                              }
                              draftDirty={
                                draftEdits[row.id] != null &&
                                draftEdits[row.id] !==
                                  (row.summary?.trim() || row.body?.trim() || "")
                              }
                              claims={
                                (expandedDetail.data?.claims ?? []) as Array<{
                                  id?: string;
                                  claim_text?: string;
                                  category?: string;
                                  verification_status?: string;
                                  source_id?: string | null;
                                  source_location?: string | null;
                                }>
                              }
                              claimsLoading={Boolean(
                                expandedDetail.isLoading && expandedId === row.id
                              )}
                              detailSources={expandedDetail.data?.sources ?? model.sources}
                              busy={busy}
                              extractPending={extractClaims.isPending}
                              onSaveDraft={() => saveDraft(row.id)}
                              onGenerate={() =>
                                confirmGenerate([row.id], "generate", {
                                  persist: false,
                                  intoDraftField: true,
                                })
                              }
                              onImprove={() =>
                                confirmGenerate([row.id], "improve", {
                                  persist: false,
                                  intoDraftField: true,
                                })
                              }
                              onRunCritic={() =>
                                runCritic.mutate(row.id, {
                                  onSuccess: () => toast.success("Critic finished"),
                                  onError: (e) =>
                                    toast.error(
                                      e instanceof Error ? e.message : "Critic failed"
                                    ),
                                })
                              }
                              onVerify={() => handleStatus(row.id, "verified")}
                              onExtractClaims={() => {
                                void extractClaims
                                  .mutateAsync(row.id)
                                  .then((res) => {
                                    toast.success(
                                      `Extracted ${res?.inserted_count ?? 0} claims from sources`
                                    );
                                    return runCritic.mutateAsync(row.id);
                                  })
                                  .then(() => toast.success("Critic re-run on claims"))
                                  .catch((err: Error) =>
                                    toast.error(err.message || "Claim extraction failed")
                                  );
                              }}
                              onCollapse={() => setExpandedId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {filteredSorted.map((model) => (
              <div
                key={model.row.id}
                className="rounded-xl bg-card/80 shadow-e1 p-3 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(model.row.id)}
                    onChange={() => toggleOne(model.row.id)}
                  />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{model.row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Guidance: {model.qualityLabel} · {stepsSummary(model).line}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {model.jurisdiction}
                      {model.compact.length
                        ? ` · ${model.compact.map((b) => b.shortName).join(" · ")}`
                        : ""}
                    </p>
                    <Button
                      size="sm"
                      className="shadow-primary-btn border-0 h-7 text-xs"
                      disabled={busy}
                      onClick={() => runPrimary(model)}
                    >
                      {model.primary.label}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
