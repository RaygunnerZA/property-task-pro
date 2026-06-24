import { useState, useMemo } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { IssuesAllFilterFeed } from "@/components/dashboard/issues/IssuesAllFilterFeed";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import {
  ISSUES_NEEDS_REVIEW_SECTION,
  ISSUES_RECENT_SIGNALS_SECTION,
} from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { useWorkbenchAttentionStream } from "@/hooks/useWorkbenchAttentionStream";
import { FilterChip } from "@/components/chips/filter";
import { cn } from "@/lib/utils";
import { workbenchSectionTitleClassName } from "@/lib/workbenchSectionTitle";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import type { IntakeMode } from "@/types/intake";
import { IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
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

  const {
    groupedAttentionItems: baseGroupedAttentionItems,
    attentionCardRefs,
    resolveAttentionItem,
    handleSignalAction,
    addAttentionItemToCompliance,
  } = useWorkbenchAttentionStream({
    properties,
    selectedPropertyIds,
    onTabChange,
    onRecordsViewChange,
  });

  const showSignalFeed = issuesFilter === "all" || issuesFilter === "urgent";

  const showTaskList =
    issuesFilter === "all" || issuesFilter === "open" || issuesFilter === "done";

  const filteredAttentionItems = useMemo(() => {
    if (!showSignalFeed) return [];
    const allItems = [
      ...baseGroupedAttentionItems.urgent,
      ...baseGroupedAttentionItems.review,
      ...baseGroupedAttentionItems.recent,
    ];
    let items = allItems.filter((item) => {
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
  }, [issuesFilter, baseGroupedAttentionItems, showSignalFeed, issuesWorkbenchSearch]);

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

  const taskToolbarRecessedClass =
    "rounded-[15px] bg-background overflow-visible " +
    "shadow-[-1px_-1px_1px_0px_rgba(0,0,0,0.1),1px_1px_1px_0px_rgba(255,255,255,0.8),inset_2px_12.9px_11px_-5.2px_rgba(0,0,0,0.3),inset_0px_-5.7px_5.9px_0px_rgba(255,255,255,0)]";

  return (
    <div className="h-full flex flex-col bg-transparent pt-[8px] pb-[3px]">
      <div
        className={cn(
          "sticky top-0 z-10 bg-transparent flex min-w-0 w-full max-w-full overflow-x-hidden",
          "flex-col items-stretch gap-2 md:gap-2.5 lg:flex-row lg:items-start lg:justify-start lg:gap-3",
          "px-2 max-sm:px-2 max-pane:px-2 max-pane:gap-1"
        )}
      >
        <div className="flex w-full min-w-0 flex-1 flex-col gap-1 lg:min-w-0">
          {pageTitle ? (
            <h2 className={cn("px-0", workbenchSectionTitleClassName)}>{pageTitle}</h2>
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
                          handleSignalAction={handleSignalAction}
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
                                    handleSignalAction={handleSignalAction}
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
