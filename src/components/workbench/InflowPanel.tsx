import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import { TaskList } from "@/components/tasks/TaskList";
import {
  IssuesRecentNeedsReviewStack,
  ISSUES_NEEDS_REVIEW_SECTION,
} from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import { OnboardingAttentionFeed } from "@/components/onboarding/OnboardingAttentionFeed";
import { AttentionEducationSummary } from "@/components/onboarding/AttentionEducationSummary";
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
import { isPropertyProfileId } from "@/lib/propertyProfiles";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import { pickTopRecentSignals, pickTopReviewSignals } from "@/lib/issuesSignalOrdering";
import { cn } from "@/lib/utils";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const FOUND_SIGNALS_SECTION = {
  title: "Found signals",
  subtitle: "New updates and information detected across the system",
  emptyTitle: "No new signals",
  emptyDescription: "When messages, uploads, or environmental scans arrive, they appear here.",
} as const;

const SUGGESTED_TASKS_SECTION = {
  title: "Suggested tasks",
  subtitle: "Setup steps that help Filla learn your property.",
} as const;

const RECORDS_TO_ORGANISE_SECTION = {
  title: "Records to organise",
  subtitle: "Documents and compliance items that need filing or review.",
  emptyTitle: "Nothing to organise",
  emptyDescription: "When uploads or missing records need sorting, they appear here.",
} as const;

const NEEDS_ATTENTION_TITLES = new Set([
  "Review Fire Extinguisher Certificate",
  "Boiler Service Due Soon",
  "Unknown Document Uploaded",
]);

const TERMINAL_TASK_STATUSES = new Set(["completed", "archived", "done"]);

function isOpenWorkbenchTask(task: { status?: string | null }) {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_TASK_STATUSES.has(status);
}

function filterTasksForInflow(
  tasks: any[],
  selectedPropertyIds: Set<string> | undefined,
  properties: { id: string }[],
  memberRole: string | null | undefined,
  mode: "suggested" | "needs-attention"
) {
  const propertyIds = properties.map((p) => p.id);
  return tasks.filter((task) => {
    if (!taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)) return false;
    if (shouldHideOwnerDemoTaskForRole(task, memberRole)) return false;
    const isDemo = isOnboardingDemoTask(task);
    const open = isOpenWorkbenchTask(task);

    if (mode === "suggested") {
      return (
        isDemo &&
        open &&
        !NEEDS_ATTENTION_TITLES.has(String(task.title ?? ""))
      );
    }
    return isDemo && open && NEEDS_ATTENTION_TITLES.has(String(task.title ?? ""));
  });
}

export type InflowPanelProps = MyWorkPanelProps;

/**
 * Inflow tab — Needs attention, Found signals, Suggested tasks, Records to organise.
 */
export function InflowPanel({
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
  hideViewAllLinks = false,
}: InflowPanelProps) {
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

  const suggestedTasks = useMemo(
    () => filterTasksForInflow(displayTasks, selectedPropertyIds, properties, memberRole, "suggested"),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

  const needsAttentionTasks = useMemo(
    () => filterTasksForInflow(displayTasks, selectedPropertyIds, properties, memberRole, "needs-attention"),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

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

  const reviewItems = useMemo(
    () => pickTopReviewSignals(groupedAttentionItems.review),
    [groupedAttentionItems.review]
  );
  const recentSignals = useMemo(
    () => pickTopRecentSignals(groupedAttentionItems.recent),
    [groupedAttentionItems.recent]
  );

  const recordsToOrganise = useMemo(
    () =>
      groupedAttentionItems.review.filter(
        (item) =>
          Boolean(item.complianceSeed) ||
          item.signalKind === "document" ||
          item.signalKind === "upload"
      ),
    [groupedAttentionItems.review]
  );

  const handleViewAllInflow = () => {
    const property = searchParams.get("property");
    const suffix = property ? `?property=${encodeURIComponent(property)}` : "";
    navigate(`${WORKBENCH_SECTION_ROUTES.issues}${suffix}`);
  };

  const openRecordsOrganise = () => {
    onRecordsViewChange?.("missing" as RecordsView);
    onTabChange?.("records");
    if (!hideViewAllLinks) {
      const property = searchParams.get("property");
      const suffix = property ? `?property=${encodeURIComponent(property)}&recordsView=missing` : "?recordsView=missing";
      navigate(`/records${suffix}`);
    }
  };

  if (tasksLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-xl bg-muted/20 p-2">
            <SkeletonTaskCard />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {onboardingEducationMode && focusedPropertyId && (
        <AttentionEducationSummary
          propertyId={focusedPropertyId}
          propertyProfile={propertyProfile}
          spacesCount={spacesCount}
        />
      )}

      {onboardingEducationMode ? (
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
      ) : (
        <>
          {(reviewItems.length > 0 || needsAttentionTasks.length > 0) && (
            <section className="min-w-0 rounded-2xl bg-transparent py-1">
              <IssuesWorkbenchSectionHeader
                title="Needs attention"
                subtitle={ISSUES_NEEDS_REVIEW_SECTION.subtitle}
                count={reviewItems.length + needsAttentionTasks.length}
                countVariant="review"
                illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.needsReview}
                onViewAll={hideViewAllLinks ? undefined : handleViewAllInflow}
              />
              <div className="mt-3 space-y-2">
                {needsAttentionTasks.length > 0 && (
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
                )}
                {reviewItems.map((item) => (
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
            </section>
          )}

          <section className="min-w-0 rounded-2xl bg-transparent py-1">
            <IssuesWorkbenchSectionHeader
              title={FOUND_SIGNALS_SECTION.title}
              subtitle={FOUND_SIGNALS_SECTION.subtitle}
              count={recentSignals.length}
              countVariant="recent"
              illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.recentSignals}
              onViewAll={hideViewAllLinks ? undefined : handleViewAllInflow}
            />
            {recentSignals.length === 0 ? (
              <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground/90">{FOUND_SIGNALS_SECTION.emptyTitle}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {FOUND_SIGNALS_SECTION.emptyDescription}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {recentSignals.map((item) => (
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
            )}
          </section>

          {suggestedTasks.length > 0 && (
            <section className="min-w-0 rounded-2xl bg-transparent py-1">
              <IssuesWorkbenchSectionHeader
                title={SUGGESTED_TASKS_SECTION.title}
                subtitle={SUGGESTED_TASKS_SECTION.subtitle}
                count={suggestedTasks.length}
                countVariant="recent"
                illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork}
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

          <section className="min-w-0 rounded-2xl bg-transparent py-1">
            <IssuesWorkbenchSectionHeader
              title={RECORDS_TO_ORGANISE_SECTION.title}
              subtitle={RECORDS_TO_ORGANISE_SECTION.subtitle}
              count={recordsToOrganise.length}
              countVariant="review"
              onViewAll={hideViewAllLinks ? undefined : openRecordsOrganise}
            />
            {recordsToOrganise.length === 0 ? (
              <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground/90">{RECORDS_TO_ORGANISE_SECTION.emptyTitle}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {RECORDS_TO_ORGANISE_SECTION.emptyDescription}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {recordsToOrganise.map((item) => (
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
            )}
          </section>
        </>
      )}
    </div>
  );
}
