import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import { TaskList } from "@/components/tasks/TaskList";
import {
  ATTENTION_SIGNALS_SECTION,
  IssuesRecentNeedsReviewStack,
} from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { WorkbenchHorizontalScroller } from "@/components/workbench/WorkbenchHorizontalScroller";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useWorkbenchAttentionStream } from "@/hooks/useWorkbenchAttentionStream";
import { WORKBENCH_SECTION_ROUTES } from "@/lib/mainNavigation";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";

export interface MyWorkPanelProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
  filterToApply?: string | null;
  filtersToApply?: string[] | null;
  selectedPropertyIds?: Set<string>;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onTabChange?: (tab: string) => void;
  onRecordsViewChange?: (view: RecordsView) => void;
}

const centreScrollClass =
  "box-border max-h-full min-h-0 w-full max-w-[700px] overflow-y-auto px-[10px] max-sm:px-0 pt-2 pb-4 max-pane:px-2";

const OPEN_WORK_SECTION = {
  title: "Open work",
  subtitle: "Approved tasks awaiting completion",
  emptyTitle: "No open work",
  emptyDescription: "When issues are approved and ready to execute, they appear here.",
} as const;

function countOpenTasks(tasks: any[]) {
  return tasks.filter(
    (task) =>
      task.status === "open" ||
      task.status === "in_progress" ||
      task.status === "waiting_review"
  ).length;
}

/**
 * Home centre column — Attention feed: Open work, Needs review, Signals.
 */
export function MyWorkPanel({
  tasks: tasksProp,
  properties: propertiesProp,
  tasksLoading: tasksLoadingProp,
  onTaskClick,
  selectedTaskId,
  selectedPropertyIds,
  onMessageClick,
  onAttentionItemSelect,
  onOpenIntake,
  onTabChange,
  onRecordsViewChange,
}: MyWorkPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: tasksFromQuery = [], isLoading: tasksLoadingFromQuery } = useTasksQuery();
  const { data: propertiesFromQuery = [] } = usePropertiesQuery();

  const tasks = tasksProp ?? tasksFromQuery;
  const properties = propertiesProp ?? propertiesFromQuery;
  const tasksLoading = tasksLoadingProp ?? tasksLoadingFromQuery;

  const openWorkCount = useMemo(() => countOpenTasks(tasks), [tasks]);

  const {
    groupedAttentionItems,
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

  const handleViewAllIssues = () => {
    const property = searchParams.get("property");
    const suffix = property ? `?property=${encodeURIComponent(property)}` : "";
    navigate(`${WORKBENCH_SECTION_ROUTES.issues}${suffix}`);
  };

  if (tasksLoading) {
    return (
      <div className={cn(centreScrollClass, "flex-1 min-h-0 space-y-6")}>
        <header className="px-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Attention</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that needs your attention, in one place.
          </p>
        </header>
        <div className="space-y-3 rounded-xl bg-muted/20 p-2">
          <IssuesWorkbenchSectionHeader
            title={OPEN_WORK_SECTION.title}
            subtitle={OPEN_WORK_SECTION.subtitle}
          />
          <WorkbenchHorizontalScroller gapClassName="gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-[200px] flex-shrink-0">
                <SkeletonTaskCard />
              </div>
            ))}
          </WorkbenchHorizontalScroller>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(centreScrollClass, "flex-1 min-h-0")}>
      <div className="min-w-0 space-y-6">
        <header className="px-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Attention</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that needs your attention, in one place.
          </p>
        </header>

        <section className="min-w-0 rounded-2xl bg-transparent py-1">
          <IssuesWorkbenchSectionHeader
            title={OPEN_WORK_SECTION.title}
            subtitle={OPEN_WORK_SECTION.subtitle}
            count={openWorkCount}
            countVariant="recent"
            onViewAll={handleViewAllIssues}
          />
          {openWorkCount === 0 ? (
            <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground/90">{OPEN_WORK_SECTION.emptyTitle}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {OPEN_WORK_SECTION.emptyDescription}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <TaskList
                tasks={tasks}
                properties={properties}
                tasksLoading={false}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedTaskId}
                selectedPropertyIds={selectedPropertyIds}
                hidePrimaryUrgentChip
                embeddedInIssuesWorkbench
                embeddedSliderOnly
                compactTaskMeta
                hideDoneSection
              />
            </div>
          )}
        </section>

        <IssuesRecentNeedsReviewStack
          recentItems={groupedAttentionItems.recent}
          reviewItems={groupedAttentionItems.review}
          attentionCardRefs={attentionCardRefs}
          resolveAttentionItem={resolveAttentionItem}
          handleSignalAction={handleSignalAction}
          addAttentionItemToCompliance={addAttentionItemToCompliance}
          onOpenIntake={onOpenIntake}
          onMessageClick={onMessageClick}
          onAttentionItemSelect={onAttentionItemSelect}
          onViewAllIssues={handleViewAllIssues}
          signalsSection={ATTENTION_SIGNALS_SECTION}
        />
      </div>
    </div>
  );
}
