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
import { AttentionEducationSummary } from "@/components/onboarding/AttentionEducationSummary";
import { OnboardingAttentionFeed } from "@/components/onboarding/OnboardingAttentionFeed";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useWorkbenchAttentionStream } from "@/hooks/useWorkbenchAttentionStream";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { useAuth } from "@/hooks/useAuth";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import { WORKBENCH_SECTION_ROUTES } from "@/lib/mainNavigation";
import {
  isOnboardingDemoTask,
  propertyHasOnboardingDemoContent,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import { isPropertyProfileId } from "@/lib/propertyProfiles";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
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

function AttentionPanelHeader() {
  return (
    <header className="flex items-start justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Attention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything that needs your attention, in one place.
        </p>
      </div>
      <div className="flex shrink-0 items-end justify-end self-stretch">
        <img
          src={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.needsReview}
          alt=""
          className="h-16 w-16 object-contain object-right drop-shadow-sm sm:h-20 sm:w-20"
          decoding="async"
        />
      </div>
    </header>
  );
}

const NEEDS_ATTENTION_TITLES = new Set([
  "Review Fire Extinguisher Certificate",
  "Boiler Service Due Soon",
  "Unknown Document Uploaded",
]);

const OPEN_WORK_SECTION = {
  title: "Open work",
  subtitle: "Approved tasks awaiting completion",
  emptyTitle: "No open work",
  emptyDescription: "When issues are approved and ready to execute, they appear here.",
} as const;

const LEARN_FILLA_SECTION = {
  title: "Learn Filla",
  subtitle: "Training tasks assigned to you — explore how work, checklists, and evidence work.",
} as const;

const SUGGESTED_TASKS_SECTION = {
  title: "Suggested tasks",
  subtitle: "Setup steps that help Filla learn your property.",
} as const;

function filterTasksForWorkbench(
  tasks: any[],
  selectedPropertyIds: Set<string> | undefined,
  properties: { id: string }[],
  memberRole: string | null | undefined,
  mode: "open" | "learn" | "suggested"
) {
  const propertyIds = properties.map((p) => p.id);
  return tasks.filter((task) => {
    if (!taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)) return false;
    if (shouldHideOwnerDemoTaskForRole(task, memberRole)) return false;
    const isDemo = isOnboardingDemoTask(task);
    const isTraining = isStaffTrainingTask(task);
    const open =
      task.status === "open" ||
      task.status === "in_progress" ||
      task.status === "waiting_review";

    if (mode === "learn") return isTraining && open;
    if (mode === "suggested") {
      return (
        isDemo &&
        open &&
        !NEEDS_ATTENTION_TITLES.has(String(task.title ?? ""))
      );
    }
    return open && !isTraining && (!isDemo || memberRole === "owner" || memberRole === "manager");
  });
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
  const { user } = useAuth();
  const { mode: identityMode } = useIdentityMode();

  const { data: tasksFromQuery = [], isLoading: tasksLoadingFromQuery } = useTasksQuery();
  const { data: propertiesFromQuery = [] } = usePropertiesQuery();

  const tasks = tasksProp ?? tasksFromQuery;
  const properties = propertiesProp ?? propertiesFromQuery;
  const tasksLoading = tasksLoadingProp ?? tasksLoadingFromQuery;

  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";

  const focusedPropertyId = useMemo(() => {
    if (selectedPropertyIds?.size === 1) return Array.from(selectedPropertyIds)[0];
    if (properties.length === 1) return properties[0]?.id;
    return properties[0]?.id;
  }, [selectedPropertyIds, properties]);

  const onboardingEducationMode = useMemo(() => {
    if (!focusedPropertyId) return false;
    if (memberRole === "staff") return false;
    return propertyHasOnboardingDemoContent(tasks, focusedPropertyId);
  }, [focusedPropertyId, memberRole, tasks]);

  const propertyProfile = useMemo(() => {
    const raw = user?.user_metadata?.property_profile;
    return isPropertyProfileId(raw) ? raw : null;
  }, [user?.user_metadata?.property_profile]);

  const spacesCount = useMemo(() => {
    const p = properties.find((x) => x.id === focusedPropertyId);
    return typeof p?.spaces_count === "number" ? p.spaces_count : 0;
  }, [properties, focusedPropertyId]);

  const displayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => !shouldHideOwnerDemoTaskForRole(t, memberRole === "staff" ? "staff" : null)
      ),
    [tasks, memberRole]
  );

  const openWorkTasks = useMemo(
    () => filterTasksForWorkbench(displayTasks, selectedPropertyIds, properties, memberRole, "open"),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

  const learnFillaTasks = useMemo(
    () =>
      filterTasksForWorkbench(displayTasks, selectedPropertyIds, properties, memberRole, "learn").filter(
        (t) => t.assigned_user_id === user?.id
      ),
    [displayTasks, selectedPropertyIds, properties, memberRole, user?.id]
  );

  const suggestedTasks = useMemo(
    () => filterTasksForWorkbench(displayTasks, selectedPropertyIds, properties, memberRole, "suggested"),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

  const needsAttentionTasks = useMemo(
    () =>
      filterTasksForWorkbench(displayTasks, selectedPropertyIds, properties, memberRole, "open").filter(
        (t) => isOnboardingDemoTask(t) && NEEDS_ATTENTION_TITLES.has(String(t.title ?? ""))
      ),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

  const openWorkCount = openWorkTasks.length + (onboardingEducationMode ? suggestedTasks.length : 0);

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
    onboardingEducationMode,
  });

  const handleViewAllIssues = () => {
    const property = searchParams.get("property");
    const suffix = property ? `?property=${encodeURIComponent(property)}` : "";
    navigate(`${WORKBENCH_SECTION_ROUTES.issues}${suffix}`);
  };

  if (tasksLoading) {
    return (
      <div className={cn(centreScrollClass, "flex-1 min-h-0 space-y-6")}>
        <AttentionPanelHeader />
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
        <AttentionPanelHeader />

        {onboardingEducationMode && focusedPropertyId && (
          <AttentionEducationSummary
            propertyId={focusedPropertyId}
            propertyProfile={propertyProfile}
            spacesCount={spacesCount}
          />
        )}

        {learnFillaTasks.length > 0 && (
          <section className="min-w-0 rounded-2xl bg-transparent py-1">
            <IssuesWorkbenchSectionHeader
              title={LEARN_FILLA_SECTION.title}
              subtitle={LEARN_FILLA_SECTION.subtitle}
              count={learnFillaTasks.length}
              countVariant="recent"
            />
            <div className="mt-3">
              <TaskList
                tasks={learnFillaTasks}
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
          </section>
        )}

        {onboardingEducationMode ? (
          <>
            {needsAttentionTasks.length > 0 && (
              <section className="min-w-0 rounded-2xl bg-transparent py-1">
                <IssuesWorkbenchSectionHeader
                  title="Needs attention"
                  subtitle="Example items that need a decision or follow-up."
                  count={needsAttentionTasks.length}
                  countVariant="review"
                />
                <div className="mt-3">
                  <TaskList
                    tasks={needsAttentionTasks}
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
              </section>
            )}

            {suggestedTasks.length > 0 && (
              <section className="min-w-0 rounded-2xl bg-transparent py-1">
                <IssuesWorkbenchSectionHeader
                  title={SUGGESTED_TASKS_SECTION.title}
                  subtitle={SUGGESTED_TASKS_SECTION.subtitle}
                  count={suggestedTasks.length}
                  countVariant="recent"
                />
                <div className="mt-3">
                  <TaskList
                    tasks={suggestedTasks}
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
              </section>
            )}

            <OnboardingAttentionFeed
              attentionCardRefs={attentionCardRefs}
              resolveAttentionItem={resolveAttentionItem}
              handleSignalAction={handleSignalAction}
              addAttentionItemToCompliance={addAttentionItemToCompliance}
              onOpenIntake={onOpenIntake}
              onMessageClick={onMessageClick}
              onAttentionItemSelect={onAttentionItemSelect}
              reviewItems={groupedAttentionItems.review.filter((i) => i.isOnboardingExample !== false && !i.isUiFixture)}
              recentItems={groupedAttentionItems.recent.filter((i) => !i.isUiFixture)}
            />
          </>
        ) : (
          <>
            <section className="min-w-0 rounded-2xl bg-transparent py-1">
              <IssuesWorkbenchSectionHeader
                title={OPEN_WORK_SECTION.title}
                subtitle={OPEN_WORK_SECTION.subtitle}
                count={openWorkTasks.length}
                countVariant="recent"
                onViewAll={handleViewAllIssues}
              />
              {openWorkTasks.length === 0 ? (
                <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
                  <p className="text-xs font-medium text-foreground/90">{OPEN_WORK_SECTION.emptyTitle}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {OPEN_WORK_SECTION.emptyDescription}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <TaskList
                    tasks={openWorkTasks}
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
          </>
        )}
      </div>
    </div>
  );
}
