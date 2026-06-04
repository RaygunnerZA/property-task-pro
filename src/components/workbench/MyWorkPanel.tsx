import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskListSectionHeader } from "@/components/tasks/TaskListSectionHeader";
import { EmptyState } from "@/components/design-system/EmptyState";
import { IssuesRecentNeedsReviewStack } from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { WorkbenchHorizontalScroller } from "@/components/workbench/WorkbenchHorizontalScroller";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useWorkbenchAttentionStream } from "@/hooks/useWorkbenchAttentionStream";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import { WORKBENCH_SECTION_ROUTES } from "@/lib/mainNavigation";
import {
  groupMyWorkTasksForScope,
  type MyWorkTimeGroup,
} from "@/lib/myWorkGrouping";
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
  "box-border max-h-full min-h-0 w-full max-w-[700px] overflow-y-auto px-[10px] max-sm:px-0 pt-[11px] pb-[11px] max-pane:px-2";

const SECTION_META: Record<
  MyWorkTimeGroup,
  { title: string; variant: "default" | "danger" | "warning" | "muted" }
> = {
  overdue: { title: "Overdue", variant: "danger" },
  today: { title: "Today", variant: "default" },
  thisWeek: { title: "This Week", variant: "warning" },
  completed: { title: "Completed", variant: "muted" },
};

function MyWorkTaskRows({
  tasks,
  propertyMap,
  selectedTaskId,
  onTaskClick,
}: {
  tasks: any[];
  propertyMap: Map<string, any>;
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const property = task.property_id
          ? propertyMap.get(task.property_id)
          : undefined;
        return (
          <TaskCard
            key={task.id}
            task={task}
            property={property}
            isSelected={selectedTaskId === task.id}
            onClick={() => task.id && onTaskClick?.(task.id)}
            layout="horizontal"
          />
        );
      })}
    </div>
  );
}

/**
 * Home centre column — open work slider, signal triage preview, then personal execution queue.
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
  const [completedOpen, setCompletedOpen] = useState(false);

  const { data: tasksFromQuery = [], isLoading: tasksLoadingFromQuery } = useTasksQuery();
  const { data: propertiesFromQuery = [] } = usePropertiesQuery();

  const tasks = tasksProp ?? tasksFromQuery;
  const properties = propertiesProp ?? propertiesFromQuery;
  const tasksLoading = tasksLoadingProp ?? tasksLoadingFromQuery;

  const propertyMap = useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties]
  );

  const grouped = useMemo(
    () =>
      groupMyWorkTasksForScope(tasks, selectedPropertyIds, properties.length),
    [tasks, selectedPropertyIds, properties.length]
  );

  const hasActiveWork =
    grouped.overdue.length > 0 ||
    grouped.today.length > 0 ||
    grouped.thisWeek.length > 0;

  const showTodayEmptyHint = grouped.today.length === 0;

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
      <div className={cn(centreScrollClass, "flex-1 min-h-0 space-y-5")}>
        <section className="space-y-2 rounded-xl bg-muted/20 p-2">
          <IssuesWorkbenchSectionHeader
            title="Open work"
            subtitle="Approved, actionable issues and tasks — scroll sideways through open tasks below."
            illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork}
          />
          <WorkbenchHorizontalScroller gapClassName="gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-[200px] flex-shrink-0">
                <SkeletonTaskCard />
              </div>
            ))}
          </WorkbenchHorizontalScroller>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn(centreScrollClass, "flex-1 min-h-0")}
      style={{
        borderWidth: "0 0 10px",
        borderStyle: "none none solid",
        borderColor: "transparent transparent rgb(255, 255, 255)",
        borderImage:
          "linear-gradient(90deg, rgba(255, 255, 255, 0.49) 0%, rgba(255, 255, 255, 0) 100%) 1 / 1 / 0 stretch",
      }}
    >
      <div className="min-w-0 space-y-5">
        <section className="space-y-2 rounded-xl bg-muted/20 p-2">
          <IssuesWorkbenchSectionHeader
            title="Open work"
            subtitle="Approved, actionable issues and tasks — scroll sideways through open tasks below."
            illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork}
          />
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
          layout="horizontal"
          onViewAllIssues={handleViewAllIssues}
        />

        <section className="min-h-0 space-y-5 rounded-xl bg-muted/20 p-2">
          <header className="min-w-0 px-0.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              My Work
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Today&apos;s jobs, overdue work and checklists.
            </p>
          </header>

          {grouped.overdue.length > 0 ? (
            <section className="space-y-2">
              <TaskListSectionHeader
                title={SECTION_META.overdue.title}
                count={grouped.overdue.length}
                variant={SECTION_META.overdue.variant}
              />
              <MyWorkTaskRows
                tasks={grouped.overdue}
                propertyMap={propertyMap}
                selectedTaskId={selectedTaskId}
                onTaskClick={onTaskClick}
              />
            </section>
          ) : null}

          {grouped.today.length > 0 ? (
            <section className="space-y-2">
              <TaskListSectionHeader
                title={SECTION_META.today.title}
                count={grouped.today.length}
                variant={SECTION_META.today.variant}
              />
              <MyWorkTaskRows
                tasks={grouped.today}
                propertyMap={propertyMap}
                selectedTaskId={selectedTaskId}
                onTaskClick={onTaskClick}
              />
            </section>
          ) : showTodayEmptyHint ? (
            <p className="px-1 py-1 text-sm text-muted-foreground">
              No work due today.
            </p>
          ) : null}

          {grouped.thisWeek.length > 0 ? (
            <section className="space-y-2">
              <TaskListSectionHeader
                title={SECTION_META.thisWeek.title}
                count={grouped.thisWeek.length}
                variant={SECTION_META.thisWeek.variant}
              />
              <MyWorkTaskRows
                tasks={grouped.thisWeek}
                propertyMap={propertyMap}
                selectedTaskId={selectedTaskId}
                onTaskClick={onTaskClick}
              />
            </section>
          ) : null}

          {!hasActiveWork && grouped.completed.length === 0 && tasks.length === 0 ? (
            <EmptyState
              title="No tasks"
              subtitle="Create work from the + actions when you are ready."
            />
          ) : !hasActiveWork && grouped.completed.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              subtitle="No overdue, today, or this-week work in your current scope."
            />
          ) : null}

          {grouped.completed.length > 0 ? (
            <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
              <section className="space-y-2">
                <CollapsibleTrigger
                  type="button"
                  className="group flex w-full items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-left"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      completedOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <TaskListSectionHeader
                      title={SECTION_META.completed.title}
                      count={grouped.completed.length}
                      variant={SECTION_META.completed.variant}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  <MyWorkTaskRows
                    tasks={grouped.completed}
                    propertyMap={propertyMap}
                    selectedTaskId={selectedTaskId}
                    onTaskClick={onTaskClick}
                  />
                </CollapsibleContent>
              </section>
            </Collapsible>
          ) : null}
        </section>
      </div>
    </div>
  );
}
