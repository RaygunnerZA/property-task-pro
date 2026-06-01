import { useState, useMemo, useRef, useEffect } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { IssuesAllFilterFeed } from "@/components/dashboard/issues/IssuesAllFilterFeed";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import {
  ISSUES_NEEDS_REVIEW_SECTION,
  ISSUES_RECENT_SIGNALS_SECTION,
} from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import {
  type AttentionItem,
  type ComplianceRecord,
  daysUntil,
  formatAuthorDisplayName,
  formatDueText,
  mapSignalFixtureToAttentionItem,
  normalizeComplianceStatus,
} from "@/components/dashboard/issues/issuesAttentionItem";
import { useMessages, type UseMessagesOptions } from "@/hooks/useMessages";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useSignalUiFixturesEnabled } from "@/hooks/useSignalUiFixtures";
import {
  SIGNAL_UI_FIXTURES_RECENT,
  SIGNAL_UI_FIXTURES_REVIEW,
  SIGNAL_UI_FIXTURES_URGENT,
} from "@/fixtures/signalUiSamples";
import { FilterChip } from "@/components/chips/filter";
import { cn } from "@/lib/utils";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import type { IntakeMode } from "@/types/intake";
import { IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
import { format } from "date-fns";
import type { RecordsView, WorkbenchIssuesFilter } from "@/lib/propertyRoutes";
import { pickDoneWorkbenchTaskPreviews } from "@/lib/workbenchDoneTasks";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";

export interface IssuesTriagePanelProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  /** Issues stream card → third column / modal (message thread or read-only signal snapshot). */
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  selectedItem?: { type: "task" | "message" | "signal"; id: string } | null;
  filterToApply?: string | null;
  filtersToApply?: string[] | null;
  /** Issues sub-filter (URL-backed on dashboard). */
  issuesFilter?: WorkbenchIssuesFilter;
  onIssuesFilterChange?: (filter: WorkbenchIssuesFilter) => void;
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
  /** Navigate to Records after promoting a signal (e.g. compliance). */
  onTabChange?: (tab: string) => void;
  onRecordsViewChange?: (view: RecordsView) => void;
  pageTitle?: string;
}

const ISSUES_CHIP_FILTERS: { id: WorkbenchIssuesFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

const SIGNAL_STACK_SECTIONS = [
  {
    key: "urgent",
    title: "Urgent",
    subtitle: "Time-sensitive signals — still not tasks until you act on them below.",
    itemsKey: "urgent" as const,
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.urgent,
  },
  {
    key: "review",
    title: ISSUES_NEEDS_REVIEW_SECTION.title,
    subtitle: ISSUES_NEEDS_REVIEW_SECTION.subtitle,
    itemsKey: "review" as const,
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.needsReview,
  },
  {
    key: "recent",
    title: ISSUES_RECENT_SIGNALS_SECTION.title,
    subtitle: ISSUES_RECENT_SIGNALS_SECTION.subtitle,
    itemsKey: "recent" as const,
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.recentSignals,
  },
] as const;

/**
 * Manager signal triage — uploads, review queue, urgent signals, optional open work.
 * Used on `/issues`; not the Home execution surface.
 */
export function IssuesTriagePanel({
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  onMessageClick,
  onAttentionItemSelect,
  selectedItem,
  filterToApply,
  filtersToApply,
  issuesFilter: issuesFilterProp,
  onIssuesFilterChange,
  selectedPropertyIds,
  onOpenIntake,
  onTabChange,
  onRecordsViewChange,
  pageTitle = "Issues",
}: IssuesTriagePanelProps = {}) {
  const messagesOptions = useMemo<UseMessagesOptions | undefined>(() => {
    const n = properties.length;
    if (n === 0) return undefined;
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size >= n
    ) {
      return undefined;
    }
    return {
      propertyScope: {
        selectedIds: Array.from(selectedPropertyIds),
        totalPropertyCount: n,
      },
    };
  }, [properties.length, selectedPropertyIds]);

  const { messages } = useMessages(messagesOptions);
  const signalUiFixturesEnabled = useSignalUiFixturesEnabled();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();

  const [internalIssuesFilter, setInternalIssuesFilter] = useState<WorkbenchIssuesFilter>("all");
  const workbenchControls = useOptionalWorkbenchControls();
  const [localIssuesSearch, setLocalIssuesSearch] = useState("");
  const issuesWorkbenchSearch = workbenchControls?.searchQuery ?? localIssuesSearch;
  const setIssuesWorkbenchSearch = workbenchControls?.setSearchQuery ?? setLocalIssuesSearch;
  const issuesFilter = issuesFilterProp ?? internalIssuesFilter;
  const setIssuesFilter = (next: WorkbenchIssuesFilter) => {
    onIssuesFilterChange?.(next);
    if (onIssuesFilterChange == null) setInternalIssuesFilter(next);
  };
  const [resolvedAttentionIds, setResolvedAttentionIds] = useState<Set<string>>(new Set());
  const [attentionComplianceDrafts, setAttentionComplianceDrafts] = useState<ComplianceRecord[]>([]);
  const attentionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const complianceRecords = useMemo<ComplianceRecord[]>(() => {
    const recordsFromView = (compliancePortfolio as any[]).map((row) => {
      const title = row.title || row.document_type || "Compliance Record";
      const propertyName = row.property_name || "Unassigned property";
      const dueOrExpiry = row.next_due_date || row.expiry_date;
      const computedStatus = normalizeComplianceStatus(row.expiry_state || row.status);
      const dayDelta = daysUntil(dueOrExpiry);

      let status = computedStatus;
      if (status === "healthy" && dayDelta !== null && dayDelta <= 30 && dayDelta >= 0) {
        status = "expiring";
      }
      if (status === "healthy" && dayDelta !== null && dayDelta < 0) {
        status = "overdue";
      }

      return {
        id: String(row.id || `compliance-${Math.random().toString(36).slice(2, 10)}`),
        title,
        propertyName,
        propertyId: row.property_id,
        complianceType: row.document_type || "General",
        expiryDate: row.expiry_date,
        nextDueDate: row.next_due_date,
        status,
        linkedDocument: row.title || row.document_type || "Document",
        inspectionHistory: row.next_due_date
          ? [`Next due ${formatDueText(row.next_due_date)}`]
          : ["No inspection history yet"],
        linkedTasks: [],
        notes:
          row.hazards?.length > 0
            ? `Potential hazards: ${row.hazards.join(", ")}`
            : "No hazards flagged.",
      } as ComplianceRecord;
    });

    const merged = [...attentionComplianceDrafts, ...recordsFromView];
    const byId = new Map<string, ComplianceRecord>();
    merged.forEach((record) => {
      if (!byId.has(record.id)) byId.set(record.id, record);
    });
    return Array.from(byId.values());
  }, [attentionComplianceDrafts, compliancePortfolio]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const fixtureUrgent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_URGENT.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureReview = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_REVIEW.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureRecent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_RECENT.map((f, i) => mapSignalFixtureToAttentionItem(f, i))
      : [];

    const urgentFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "overdue")
      .slice(0, 4)
      .map((record) => ({
        id: `urgent-${record.id}`,
        group: "urgent" as const,
        title: `Possible ${record.complianceType.toLowerCase()} risk`,
        context: `${record.propertyName} • ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        footChipLabel: "COMPLIANCE RISK",
        description: `${record.title} is overdue and may need immediate attention.`,
      }));

    const reviewFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "expiring" || record.status === "missing")
      .slice(0, 8)
      .map((record) => {
        const whyHere =
          record.status === "missing"
            ? "Not sure this belongs in compliance tracking yet."
            : "Expiry or renewal timing needs confirmation.";
        return {
          id: `review-${record.id}`,
          group: "review" as const,
          title: `${record.complianceType} — needs a decision`,
          context: record.propertyName,
          whyHere,
          description:
            record.status === "missing"
              ? "The system is not sure this belongs in compliance tracking yet. Classify it, assign an owner, or convert it into a stored record."
              : `Expiry or renewal timing may need confirmation before it becomes a tracked obligation. Decide how Filla should treat it.`,
          complianceSeed: {
            title: record.title,
            propertyName: record.propertyName,
            propertyId: record.propertyId,
            complianceType: record.complianceType,
          },
        };
      });

    const recentFromData: AttentionItem[] = messages.slice(0, 10).map((message: any) => {
      const authorName = formatAuthorDisplayName(message.author_name);
      const body = message.body ? String(message.body).replace(/\s+/g, " ").trim() : "";
      const titleFromBody =
        body.length > 0
          ? body.slice(0, 72) + (body.length > 72 ? "…" : "")
          : `Message from ${authorName}`;
      return {
        id: `recent-msg-${message.id}`,
        group: "recent" as const,
        signalKind: "message" as const,
        messageId: message.id,
        footChipLabel: "TENANT MESSAGE",
        title: titleFromBody,
        context: `${authorName} • ${format(new Date(message.created_at), "dd MMM, HH:mm")}`,
        description:
          body.length > 120 ? `${body.slice(0, 120)}…` : body || "Something new arrived — open it when you are ready to triage.",
        occurredAt: new Date(message.created_at).getTime(),
      };
    });

    const urgent = [...fixtureUrgent, ...urgentFromData];
    const review = [...fixtureReview, ...reviewFromData];
    const recent = [...fixtureRecent, ...recentFromData];

    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
      return [
        {
          id: "recent-empty-seed",
          group: "recent" as const,
          title: "No signals in your timeline yet",
          context: "This is your inbox of “something happened”",
          footChipLabel: "GETTING STARTED",
          description:
            "Uploads, messages, documents, and system events will appear here as a raw feed — before they become tasks or records. Use Report Issue or Add Record when you want to log something manually.",
        },
      ];
    }

    return [...urgent, ...review, ...recent];
  }, [complianceRecords, messages, signalUiFixturesEnabled]);

  const unresolvedAttentionItems = useMemo(() => {
    return attentionItems.filter((item) => !resolvedAttentionIds.has(item.id));
  }, [attentionItems, resolvedAttentionIds]);

  const showSignalFeed = issuesFilter === "all" || issuesFilter === "urgent";

  const showTaskList =
    issuesFilter === "all" || issuesFilter === "open" || issuesFilter === "done";

  const filteredAttentionItems = useMemo(() => {
    if (!showSignalFeed) return [];
    let items = unresolvedAttentionItems.filter((item) => {
      if (issuesFilter === "all") return true;
      if (issuesFilter === "urgent") return item.group === "urgent";
      return false;
    });
    const q = issuesWorkbenchSearch.trim().toLowerCase();
    if (q) {
      items = items.filter((item) => {
        const text = [item.title, item.context, item.description, item.whyHere]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }
    return items;
  }, [issuesFilter, unresolvedAttentionItems, showSignalFeed, issuesWorkbenchSearch]);

  const groupedAttentionItems = useMemo(() => {
    const urgent = filteredAttentionItems.filter((item) => item.group === "urgent");
    const review = filteredAttentionItems.filter((item) => item.group === "review");
    const recent = filteredAttentionItems.filter((item) => item.group === "recent");
    return { urgent, review, recent };
  }, [filteredAttentionItems]);

  const doneWorkbenchTasks = useMemo(
    () =>
      pickDoneWorkbenchTaskPreviews(tasks, {
        properties: properties ?? [],
        selectedPropertyIds,
        searchQuery: issuesWorkbenchSearch,
      }),
    [tasks, properties, selectedPropertyIds, issuesWorkbenchSearch]
  );

  const resolveAttentionItem = (itemId: string) => {
    setResolvedAttentionIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  };

  const addAttentionItemToCompliance = (item: AttentionItem) => {
    if (!item.complianceSeed) return;
    const newRecord: ComplianceRecord = {
      id: `attention-${item.id}`,
      title: item.complianceSeed.title,
      propertyName: item.complianceSeed.propertyName,
      propertyId: item.complianceSeed.propertyId,
      complianceType: item.complianceSeed.complianceType,
      expiryDate: null,
      nextDueDate: null,
      status: "missing",
      linkedDocument: "Pending document",
      inspectionHistory: ["Created from Issues"],
      linkedTasks: [],
      notes: "Promoted from Issues for compliance tracking.",
    };

    setAttentionComplianceDrafts((prev) => {
      if (prev.some((record) => record.id === newRecord.id)) return prev;
      return [newRecord, ...prev];
    });
    onTabChange?.("records");
    onRecordsViewChange?.("missing");
  };

  const taskToolbarRecessedClass =
    "rounded-[15px] bg-background overflow-visible " +
    "shadow-[-1px_-1px_1px_0px_rgba(0,0,0,0.1),1px_1px_1px_0px_rgba(255,255,255,0.8),inset_2px_12.9px_11px_-5.2px_rgba(0,0,0,0.3),inset_0px_-5.7px_5.9px_0px_rgba(255,255,255,0)]";

  return (
    <div className="h-full flex flex-col bg-transparent pt-[8px] pb-[3px]">
      <div
        className={cn(
          "sticky top-0 z-10 bg-transparent flex min-w-0 w-full max-w-full overflow-x-hidden",
          "flex-col items-stretch gap-2 md:gap-2.5 lg:flex-row lg:items-start lg:justify-start lg:gap-3",
          "px-[10px] max-sm:px-0 max-pane:px-2 max-pane:gap-1"
        )}
      >
        <div className="flex w-full min-w-0 flex-1 flex-col gap-1 lg:min-w-0">
          {pageTitle ? (
            <h2 className="px-1 text-base font-semibold tracking-tight text-foreground">{pageTitle}</h2>
          ) : null}
        </div>

        {onOpenIntake ? (
            <div className="hidden min-w-0 layout:hidden sm:block lg:w-[255px] lg:shrink-0 lg:self-start lg:h-12 lg:min-h-12">
              <div className={cn("w-full min-w-0 lg:h-12 lg:min-h-12", taskToolbarRecessedClass)}>
                <div
                  className={cn(
                    "grid h-12 min-h-12 w-full grid-cols-2 items-stretch gap-x-1.5 px-2 pt-[6px] pb-1.5",
                    "lg:h-12 lg:min-h-12 lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1.5 lg:px-2 lg:py-1.5",
                    "max-pane:px-1"
                  )}
                >
                  <IntakeActionButtonPair
                    variant="toolbar"
                    layout="grid"
                    onAddRecord={() => onOpenIntake("add_record")}
                    onReportIssue={() => onOpenIntake("report_issue")}
                  />
                </div>
              </div>
            </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden h-[515px] shrink-0">
        <div
              className="box-border max-h-full min-h-0 w-full max-w-[700px] overflow-y-auto px-[10px] max-sm:px-0 pt-[11px] pb-[11px] max-pane:px-2"
              style={{
                borderWidth: "0 0 10px",
                borderStyle: "none none solid",
                borderColor: "transparent transparent rgb(255, 255, 255)",
                borderImage:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0.49) 0%, rgba(255, 255, 255, 0) 100%) 1 / 1 / 0 stretch",
              }}
            >
                <div className="min-w-0 space-y-3">
                <div className="mt-[5px] min-w-0 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {ISSUES_CHIP_FILTERS.map(({ id, label }) => (
                      <FilterChip
                        key={id}
                        label={label}
                        selected={issuesFilter === id}
                        onSelect={() => setIssuesFilter(id)}
                      />
                    ))}
                  </div>
                </div>

                {showTaskList && (
                  <div
                    className={cn(
                      "min-h-0",
                      showSignalFeed && issuesFilter === "all" && "mb-6 border-b border-border/50 pb-4"
                    )}
                  >
                    {issuesFilter === "all" && (
                      <IssuesWorkbenchSectionHeader
                        className="mb-2"
                        title="Open work"
                        subtitle="Approved, actionable issues and tasks — scroll sideways through open tasks below."
                        illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork}
                      />
                    )}
                    <div className="h-full flex flex-col min-h-0 rounded-xl bg-muted/20 p-2">
                      <TaskList
                        key={`issues-tasklist-${issuesFilter}`}
                        tasks={tasks}
                        properties={properties}
                        tasksLoading={tasksLoading}
                        onTaskClick={onTaskClick}
                        selectedTaskId={selectedItem?.type === "task" ? selectedItem.id : undefined}
                        filterToApply={filterToApply}
                        filtersToApply={filtersToApply}
                        selectedPropertyIds={selectedPropertyIds}
                        hidePrimaryUrgentChip
                        embeddedInIssuesWorkbench
                        externalTaskSearchQuery={issuesWorkbenchSearch}
                        onExternalTaskSearchQueryChange={setIssuesWorkbenchSearch}
                        compactTaskMeta
                        hideDoneSection={issuesFilter === "all"}
                      />
                    </div>
                  </div>
                )}

                {showSignalFeed && (
                  <div className="space-y-4">
                    {issuesFilter === "all" ? (
                      <>
                        <IssuesAllFilterFeed
                          groupedAttention={{
                            recent: groupedAttentionItems.recent,
                            review: groupedAttentionItems.review,
                          }}
                          doneWorkbenchTasks={doneWorkbenchTasks}
                          attentionCardRefs={attentionCardRefs}
                          resolveAttentionItem={resolveAttentionItem}
                          addAttentionItemToCompliance={addAttentionItemToCompliance}
                          onOpenIntake={onOpenIntake}
                          onMessageClick={onMessageClick}
                          onAttentionItemSelect={onAttentionItemSelect}
                          onTaskClick={onTaskClick}
                        />
                      </>
                    ) : (
                      <>
                        {SIGNAL_STACK_SECTIONS.map(({ key, title, subtitle, itemsKey, illustrationSrc }) => {
                          const items = groupedAttentionItems[itemsKey];
                          return items.length > 0 ? (
                            <div key={key} className="space-y-2">
                              <IssuesWorkbenchSectionHeader
                                title={title}
                                subtitle={subtitle}
                                illustrationSrc={illustrationSrc}
                                spacious
                              />
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <IssuesSignalCard
                                    key={item.id}
                                    item={item}
                                    attentionCardRefs={attentionCardRefs}
                                    resolveAttentionItem={resolveAttentionItem}
                                    addAttentionItemToCompliance={addAttentionItemToCompliance}
                                    onOpenIntake={onOpenIntake}
                                    onMessageClick={onMessageClick}
                                    onAttentionItemSelect={onAttentionItemSelect}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })}
                        {filteredAttentionItems.length === 0 && (
                          <div className="rounded-xl bg-card/70 shadow-e1 p-4 text-sm text-muted-foreground">
                            No signals match this slice. Try All to see the full feed, or Open for tasks.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
        </div>
      </div>
    </div>
  );
}
