import { useMemo, useEffect, useRef } from "react";
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
import { centreWorkbenchTasksPath } from "@/lib/centreWorkbenchTabs";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const FOUND_SIGNALS_SECTION = {
  title: "Found signals",
  subtitle: "Uploads, emails, and system events that can become work",
  emptyTitle: "Nothing new to triage",
  emptyDescription:
    "When uploads, emails, or environmental scans arrive, they appear here so you can convert or dismiss them.",
} as const;

const SUGGESTED_TASKS_SECTION = {
  title: "Suggested tasks",
  subtitle: "Setup steps that help Filla learn your property.",
} as const;

const RECORDS_TO_ORGANISE_SECTION = {
  title: "Records to organise",
  subtitle: "Documents still waiting to be filed — open Records to finish them.",
  emptyTitle: "Nothing to organise",
  emptyDescription: "When uploads or missing records need sorting, they appear here.",
  ctaLabel: "Organise in Records",
} as const;

const STAFF_INFLOW_EMPTY = {
  title: "Nothing waiting for your decision",
  description: "Open work lives on the Tasks tab. Managers triage signals and records here.",
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
 * Inflow tab — short decision funnel into work (Needs review · Signals · Suggested · Records).
 * Manager/owner-oriented triage; staff see a lighter empty pointing at Tasks.
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
  onOpenAddToFilla,
  onTabChange,
  onRecordsViewChange,
  hideViewAllLinks = false,
}: InflowPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { mode: identityMode } = useIdentityMode();

  /** Frontline users execute on Tasks; signal triage stays manager/owner-facing. */
  const showManagerTriage = identityMode === "manager" || identityMode === "personal";

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
    () =>
      filterTasksForInflow(displayTasks, selectedPropertyIds, properties, memberRole, "suggested").slice(
        0,
        3
      ),
    [displayTasks, selectedPropertyIds, properties, memberRole]
  );

  const needsAttentionTasks = useMemo(
    () =>
      filterTasksForInflow(
        displayTasks,
        selectedPropertyIds,
        properties,
        memberRole,
        "needs-attention"
      ).slice(0, 3),
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
    onOpenAddToFilla,
  });

  const reviewItems = useMemo(
    () => pickTopReviewSignals(groupedAttentionItems.review),
    [groupedAttentionItems.review]
  );
  const recentSignals = useMemo(
    () =>
      pickTopRecentSignals(groupedAttentionItems.recent).filter(
        (item) => item.id !== "recent-empty-seed"
      ),
    [groupedAttentionItems.recent]
  );

  const recordsToOrganiseCount = useMemo(
    () =>
      groupedAttentionItems.review.filter(
        (item) =>
          Boolean(item.complianceSeed) ||
          item.signalKind === "document" ||
          item.signalKind === "upload"
      ).length,
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
      const suffix = property
        ? `?property=${encodeURIComponent(property)}&recordsView=missing`
        : "?recordsView=missing";
      navigate(`/records${suffix}`);
    }
  };

  const openTasksTab = () => {
    const property = searchParams.get("property");
    const params = new URLSearchParams();
    if (property) params.set("property", property);
    navigate(centreWorkbenchTasksPath("tasks", params));
  };

  const foundSignalsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (searchParams.get("inflow") !== "signals") return;
    const node = foundSignalsRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams, tasksLoading]);

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
    <div className="min-w-0 space-y-6 pt-0">
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
          reviewItems={groupedAttentionItems.review.filter(
            (i) => i.isOnboardingExample !== false && !i.isUiFixture
          )}
          recentItems={groupedAttentionItems.recent.filter((i) => !i.isUiFixture)}
          propertyId={focusedPropertyId}
        />
      ) : !showManagerTriage ? (
        <>
          {suggestedTasks.length > 0 ? (
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
          ) : (
            <div className="mt-1 space-y-2 rounded-xl bg-muted/20 px-3 py-3">
              <p className="text-xs font-medium text-foreground/90">{STAFF_INFLOW_EMPTY.title}</p>
              <p className="text-caption leading-relaxed text-muted-foreground">
                {STAFF_INFLOW_EMPTY.description}
              </p>
              <button
                type="button"
                onClick={openTasksTab}
                className="text-caption font-semibold text-primary hover:underline"
              >
                Go to Tasks
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="min-w-0 rounded-2xl bg-transparent pt-0 pb-1">
            <IssuesWorkbenchSectionHeader
              title={ISSUES_NEEDS_REVIEW_SECTION.title}
              subtitle={ISSUES_NEEDS_REVIEW_SECTION.subtitle}
              count={reviewItems.length + needsAttentionTasks.length}
              countVariant="review"
              illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.needsReview}
              onViewAll={hideViewAllLinks ? undefined : handleViewAllInflow}
            />
            {reviewItems.length === 0 && needsAttentionTasks.length === 0 ? (
              <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground/90">
                  {ISSUES_NEEDS_REVIEW_SECTION.emptyTitle}
                </p>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {ISSUES_NEEDS_REVIEW_SECTION.emptyDescription}
                </p>
              </div>
            ) : (
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

          <section
            ref={foundSignalsRef}
            className="min-w-0 rounded-2xl bg-transparent py-1"
            id="found-signals"
          >
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
                <p className="text-caption leading-relaxed text-muted-foreground">
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

          {recordsToOrganiseCount > 0 ? (
            <section className="min-w-0 rounded-2xl bg-transparent py-1">
              <IssuesWorkbenchSectionHeader
                title={RECORDS_TO_ORGANISE_SECTION.title}
                subtitle={RECORDS_TO_ORGANISE_SECTION.subtitle}
                count={recordsToOrganiseCount}
                countVariant="review"
                onViewAll={hideViewAllLinks ? undefined : openRecordsOrganise}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/20 px-3 py-2.5">
                <p className="min-w-0 flex-1 text-caption leading-relaxed text-muted-foreground">
                  {recordsToOrganiseCount} document
                  {recordsToOrganiseCount === 1 ? "" : "s"} still need filing — finish them in
                  Records so they don’t sit in triage.
                </p>
                <button
                  type="button"
                  onClick={openRecordsOrganise}
                  className="shrink-0 text-caption font-semibold text-primary hover:underline"
                >
                  {RECORDS_TO_ORGANISE_SECTION.ctaLabel}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
