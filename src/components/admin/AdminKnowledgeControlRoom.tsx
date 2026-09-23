/**
 * One Knowledge control room — decision queue, not a backlog of every Knowledge row.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  useAdminContentTopics,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminKnowledgeMetrics,
  useAdminKnowledgeQueue,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminAiBatchJobsBanner } from "@/components/admin/AdminAiBatchJobsBanner";
import { AdminKnowledgeIntakePanel } from "@/components/admin/AdminKnowledgeIntakePanel";
import { AdminKnowledgePackageWorkspace } from "@/components/admin/AdminKnowledgePackageWorkspace";
import { AdminKnowledgeReviewWorkbench } from "@/components/admin/AdminKnowledgeReviewWorkbench";
import { AdminOutputsPanel } from "@/components/admin/AdminOutputsPanel";
import { AdminKnowledgeDetailSheet } from "@/components/admin/AdminKnowledgeDetailSheet";
import { AdminKnowledgeReportingPanel } from "@/components/admin/AdminKnowledgeReportingPanel";
import { CatalogueMonitoringStrip } from "@/components/admin/AdminKnowledgeCataloguePanel";
import { KnowledgeWatchSettingsControl } from "@/components/admin/KnowledgeWatchSettingsControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  buildSubjectPackages,
  CONTROL_FILTER_LABELS,
  filterCounts,
  groupAttentionPackages,
  packagesForFilter,
  type ControlFilter,
  type SubjectPackage,
} from "@/lib/content/knowledgeSubjectPackage";
import { DISCOVERY_SOURCE_FILTERS, type DiscoverySourceFilter } from "@/lib/content/knowledgeWatch";
import { proposePilotCalendarWindows } from "@/lib/content/knowledgeEditorialCalendar";
import { mergeSchedulePrefsIntoPublishing } from "@/lib/content/knowledgeSchedule";
import { isPublicationReady, queueCardPreview } from "@/lib/knowledge/knowledgePresentation";
import type { KnowledgeRow } from "@/types/knowledge";

type OverflowView = null | "legacy-review" | "advanced" | "reporting";

function CompactRow({
  pkg,
  onOpen,
}: {
  pkg: SubjectPackage;
  onOpen: () => void;
}) {
  // Always openable — Monitoring/QUEUED rows still need review (e.g. filename-titled candidates).
  const scheduleBadge =
    pkg.scheduleState === "proposed"
      ? "Proposed"
      : pkg.scheduleState === "confirmed"
        ? "Confirmed"
        : null;
  const reasonLine =
    pkg.reasonChips.length > 0 ? pkg.reasonChips.join(" · ") : pkg.whyNow;

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border/30 py-2.5 last:border-0",
        "cursor-pointer hover:bg-muted/20 -mx-2 px-2 rounded-lg"
      )}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">{pkg.title}</p>
          {scheduleBadge && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {scheduleBadge}
              {pkg.windowLabel ? ` · ${pkg.windowLabel}` : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{pkg.coverageSummary}</p>
        {pkg.filter === "attention" && pkg.nextDecisionReason ? (
          <p className="text-xs text-muted-foreground leading-snug">{pkg.nextDecisionReason}</p>
        ) : pkg.deliverablesSummary &&
          pkg.deliverablesSummary !== pkg.coverageSummary &&
          pkg.deliverablesSummary !== "Assessing opportunity" ? (
          <p className="text-xs text-muted-foreground leading-snug">{pkg.deliverablesSummary}</p>
        ) : reasonLine && reasonLine !== pkg.coverageSummary ? (
          <p className="text-xs text-muted-foreground leading-snug">{reasonLine}</p>
        ) : null}
      </div>
      {pkg.actionLabel ? (
        <Button
          size="sm"
          variant={pkg.filter === "attention" ? "default" : "outline"}
          className={cn(
            "shrink-0 h-8 text-xs border-0",
            pkg.filter === "attention" ? "shadow-primary-btn" : "btn-neomorphic"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {pkg.actionLabel}
        </Button>
      ) : (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 pt-1.5 w-[7.5rem] text-right">
          {pkg.machineState === "planning_queued"
            ? "Queued"
            : pkg.machineState === "planning"
              ? "Planning"
              : pkg.machineState === "not_timely"
                ? "Waiting"
                : ""}
        </span>
      )}
    </div>
  );
}

export function AdminKnowledgeControlRoom() {
  const knowledgeQuery = useAdminKnowledgeQueue([
    "candidate",
    "verified",
    "published",
    "stale",
  ]);
  const topicsQuery = useAdminContentTopics();
  const metricsQuery = useAdminKnowledgeMetrics();
  const createTopic = useAdminCreateContentTopic();
  const generate = useAdminGenerateContent();
  const upsertStage = useAdminUpsertContentTopicStage();

  const [filter, setFilter] = useState<ControlFilter>("attention");
  const [sourceFilter, setSourceFilter] = useState<DiscoverySourceFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SubjectPackage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [overflowView, setOverflowView] = useState<OverflowView>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [planningBusy, setPlanningBusy] = useState(false);
  const autoPlanStarted = useRef<Set<string>>(new Set());

  const packages = useMemo(
    () =>
      buildSubjectPackages({
        knowledge: (knowledgeQuery.data ?? []) as KnowledgeRow[],
        topics: topicsQuery.data ?? [],
      }),
    [knowledgeQuery.data, topicsQuery.data]
  );

  // Keep the open package in sync after Accept / research / draft mutations.
  useEffect(() => {
    if (!selected) return;
    const fresh =
      packages.find((p) => p.id === selected.id) ??
      packages.find((p) => p.subjectKey === selected.subjectKey) ??
      null;
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [packages, selected]);

  const counts = useMemo(() => filterCounts(packages), [packages]);

  /** Planning only: cluster → propose calendar → plan stage. Never accept or draft content. */
  const runPlanningPass = async (limit = 3) => {
    setPlanningBusy(true);
    try {
      const calendar = proposePilotCalendarWindows({
        subjectKeys: packages.map((p) => p.subjectKey),
      });
      const calByKey = new Map(calendar.map((c) => [c.subjectKey, c]));
      const eligible = packages
        .filter((p) => p.autoPlanEligible && p.primaryKnowledgeId)
        .sort((a, b) => b.rank - a.rank)
        .slice(0, limit);

      for (const next of eligible) {
        if (autoPlanStarted.current.has(next.subjectKey)) continue;
        autoPlanStarted.current.add(next.subjectKey);
        const cal = calByKey.get(next.subjectKey);
        let topicId = next.topic?.id ?? null;
        if (!topicId) {
          const row = await createTopic.mutateAsync({
            knowledgeId: next.primaryKnowledgeId!,
            title: next.title,
          });
          topicId = row.id;
        }
        await upsertStage.mutateAsync({
          topicId,
          publishing: mergeSchedulePrefsIntoPublishing(next.topic?.publishing ?? {}, {
            schedule_state: "proposed",
            window_label: cal?.window_label ?? next.windowLabel ?? undefined,
            window_start: cal?.window_start ?? next.windowStart ?? undefined,
            reason_override: cal?.why ?? next.whyNow,
          }),
        });
        await generate.mutateAsync({ topicId, stage: "plan" });
      }
      await topicsQuery.refetch();
    } finally {
      setPlanningBusy(false);
    }
  };

  // Quiet continuation: one planning-only subject at a time while Monitoring has backlog.
  useEffect(() => {
    if (knowledgeQuery.isLoading || topicsQuery.isLoading || planningBusy) return;
    if (createTopic.isPending || generate.isPending) return;
    const next = packages.find(
      (p) =>
        p.autoPlanEligible &&
        p.primaryKnowledgeId &&
        !autoPlanStarted.current.has(p.subjectKey)
    );
    if (!next) return;
    void runPlanningPass(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate one-at-a-time kick
  }, [packages, knowledgeQuery.isLoading, topicsQuery.isLoading, planningBusy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = packagesForFilter(packages, filter, sourceFilter);
    if (!q) return list;
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.coverageSummary.toLowerCase().includes(q) ||
        p.whyNow.toLowerCase().includes(q) ||
        p.outcome.toLowerCase().includes(q) ||
        p.reasonChips.some((c) => c.toLowerCase().includes(q)) ||
        p.discoverySignals.some((s) => s.observation.toLowerCase().includes(q))
    );
  }, [packages, filter, sourceFilter, search]);

  const attentionGrouped = useMemo(
    () => groupAttentionPackages(filtered),
    [filtered]
  );

  const reviewRows = useMemo(() => {
    return (knowledgeQuery.data ?? []).filter((r) => {
      if (r.status === "published" || r.status === "archived") return false;
      if (r.status === "candidate" || r.status === "stale") return true;
      if (r.status !== "verified") return true;
      return !isPublicationReady(r, queueCardPreview(r, []).checks);
    });
  }, [knowledgeQuery.data]);

  const totals = useMemo(() => {
    const rows = metricsQuery.data ?? [];
    return {
      created: rows.reduce((s, r) => s + Number(r.knowledge_created || 0), 0),
      verified: rows.reduce((s, r) => s + Number(r.knowledge_verified || 0), 0),
      reused: rows.reduce((s, r) => s + Number(r.knowledge_reused || 0), 0),
      answered: rows.reduce((s, r) => s + Number(r.questions_answered || 0), 0),
    };
  }, [metricsQuery.data]);

  if (selected) {
    return (
      <AdminKnowledgePackageWorkspace
        pkg={selected}
        onBack={() => {
          setSelected(null);
          void knowledgeQuery.refetch();
          void topicsQuery.refetch();
        }}
        onPackageUpdated={() => {
          void topicsQuery.refetch();
          void knowledgeQuery.refetch();
        }}
      />
    );
  }

  if (overflowView === "legacy-review") {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          onClick={() => setOverflowView(null)}
        >
          Back to Knowledge
        </Button>
        <p className="text-xs text-muted-foreground">
          Legacy atomic Knowledge review — Pilot only.
        </p>
        <AdminKnowledgeReviewWorkbench
          rows={reviewRows}
          sourcesByKnowledge={new Map()}
          isLoading={knowledgeQuery.isLoading}
          onOpen={(id) => setDetailId(id)}
        />
        <AdminKnowledgeDetailSheet
          knowledgeId={detailId}
          open={Boolean(detailId)}
          onOpenChange={(open) => {
            if (!open) setDetailId(null);
          }}
        />
      </div>
    );
  }

  if (overflowView === "advanced") {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          onClick={() => setOverflowView(null)}
        >
          Back to Knowledge
        </Button>
        <AdminOutputsPanel />
      </div>
    );
  }

  if (overflowView === "reporting") {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          onClick={() => setOverflowView(null)}
        >
          Back to Knowledge
        </Button>
        <AdminKnowledgeReportingPanel totals={totals} />
      </div>
    );
  }

  const loading = knowledgeQuery.isLoading || topicsQuery.isLoading;

  const renderList = (rows: SubjectPackage[]) => (
    <div className="rounded-xl bg-card/80 shadow-e1 px-3 py-1">
      {rows.map((pkg) => (
        <CompactRow key={pkg.id} pkg={pkg} onOpen={() => setSelected(pkg)} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decisions only. Everything else continues in the background.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KnowledgeWatchSettingsControl />
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add source
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-0 btn-neomorphic">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Pilot &amp; machinery</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={planningBusy}
                onClick={() => void runPlanningPass(5)}
              >
                {planningBusy ? "Planning…" : "Resume planning (calendar only)"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOverflowView("legacy-review")}>
                Legacy Knowledge review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOverflowView("advanced")}>
                Advanced content machinery
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOverflowView("reporting")}>
                Reporting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AdminAiBatchJobsBanner />

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(CONTROL_FILTER_LABELS) as ControlFilter[]).map((id) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "default" : "outline"}
            className={cn(
              "border-0 h-8 text-xs",
              filter === id ? "shadow-primary-btn" : "btn-neomorphic"
            )}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {CONTROL_FILTER_LABELS[id]}
            <span className="ml-1.5 tabular-nums opacity-80">({counts[id]})</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Discovery source filter">
        {DISCOVERY_SOURCE_FILTERS.map((opt) => (
          <Button
            key={opt.id}
            size="sm"
            variant={sourceFilter === opt.id ? "default" : "outline"}
            className={cn(
              "border-0 h-7 text-[11px]",
              sourceFilter === opt.id ? "shadow-primary-btn" : "btn-neomorphic"
            )}
            aria-pressed={sourceFilter === opt.id}
            onClick={() => setSourceFilter(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Workflow tabs describe state. Source filters describe why a subject entered the queue
        (discovery signals — not property Issues Signals).
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects…"
            className="pl-8 h-9 bg-muted/30 border-0"
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {!loading && filter === "scheduled" && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-xl bg-card/80 shadow-e1 px-4 py-6">
          No proposed calendar yet. Use Resume planning to build Proposed packages from Monitoring —
          nothing is accepted or published.
        </p>
      )}

      {!loading && filter === "attention" && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-xl bg-card/80 shadow-e1 px-4 py-6">
          No decisions waiting. Unprocessed Knowledge continues under Monitoring; the proposed
          calendar lives under Scheduled.
        </p>
      )}

      {!loading && filter === "monitoring" && <CatalogueMonitoringStrip />}

      {!loading &&
        filter !== "attention" &&
        filter !== "scheduled" &&
        filtered.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-xl bg-card/80 shadow-e1 px-4 py-6">
            {filter === "monitoring"
              ? "Nothing in monitoring. News leads and new official pages stay here until a consequential change appears."
              : "No completed packages yet."}
          </p>
        )}

      {!loading && filter === "attention" && filtered.length > 0 && (
        <section className="space-y-2">
          {attentionGrouped.flat.length > 0 ? (
            renderList(attentionGrouped.flat)
          ) : (
            <>
              {attentionGrouped.now.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                    Now
                  </h2>
                  {renderList(attentionGrouped.now)}
                </div>
              )}
              {attentionGrouped.next.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                    Next
                  </h2>
                  {renderList(attentionGrouped.next)}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {!loading && filter !== "attention" && filtered.length > 0 && renderList(filtered)}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add source</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-3">
              The machine attaches the source to a subject or proposes one. Unprocessed work stays
              in Monitoring — not Needs attention.
            </p>
            <AdminKnowledgeIntakePanel compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AdminKnowledgeControlRoom;
