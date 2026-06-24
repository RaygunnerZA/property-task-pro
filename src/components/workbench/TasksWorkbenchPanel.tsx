import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import { TaskList } from "@/components/tasks/TaskList";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import { useDataContext } from "@/contexts/DataContext";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  isOnboardingDemoTask,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const URGENT_SECTION = {
  title: "Urgent",
  subtitle: "High-priority work that needs action soon.",
} as const;

const MY_TASKS_SECTION = {
  title: "My tasks",
  subtitle: "Work assigned to you.",
} as const;

const DUE_SOON_SECTION = {
  title: "Due soon",
  subtitle: "Tasks due in the next seven days.",
} as const;

const TERMINAL_TASK_STATUSES = new Set(["completed", "archived", "done"]);

function isOpenTask(task: { status?: string | null }) {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_TASK_STATUSES.has(status);
}

function filterOpenTasksForTasksTab(
  tasks: any[],
  selectedPropertyIds: Set<string> | undefined,
  properties: { id: string }[],
  memberRole: string | null | undefined
) {
  const propertyIds = properties.map((p) => p.id);
  return tasks.filter((task) => {
    if (!taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)) return false;
    if (shouldHideOwnerDemoTaskForRole(task, memberRole)) return false;
    if (isStaffTrainingTask(task)) return false;
    if (!isOpenTask(task)) return false;
    const isDemo = isOnboardingDemoTask(task);
    return !isDemo || memberRole === "owner" || memberRole === "manager";
  });
}

/**
 * Tasks tab — Urgent carousel, My tasks horizontal strip, Due soon.
 */
export function TasksWorkbenchPanel({
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  selectedTaskId,
  selectedPropertyIds,
}: MyWorkPanelProps) {
  const { userId } = useDataContext();
  const { mode: identityMode } = useIdentityMode();
  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";

  const scopedOpenTasks = useMemo(
    () => filterOpenTasksForTasksTab(tasks, selectedPropertyIds, properties, memberRole),
    [tasks, selectedPropertyIds, properties, memberRole]
  );

  const urgentTasks = useMemo(
    () =>
      scopedOpenTasks.filter(
        (t) => t.priority === "urgent" || t.priority === "high"
      ),
    [scopedOpenTasks]
  );

  const myTasks = useMemo(
    () => scopedOpenTasks.filter((t) => t.assigned_user_id === userId),
    [scopedOpenTasks, userId]
  );

  const dueSoonTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 7);
    return scopedOpenTasks.filter((task) => {
      if (!task.due_date) return false;
      const due = startOfDay(new Date(task.due_date));
      return due >= today && due <= horizon;
    });
  }, [scopedOpenTasks]);

  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 rounded-2xl bg-transparent py-1">
        <IssuesWorkbenchSectionHeader
          title={URGENT_SECTION.title}
          subtitle={URGENT_SECTION.subtitle}
          count={urgentTasks.length}
          countVariant="review"
          illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.urgent}
        />
        <div className="mt-3">
          <TaskList
            tasks={urgentTasks}
            properties={properties}
            tasksLoading={tasksLoading}
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

      <section className="min-w-0 rounded-2xl bg-transparent py-1">
        <IssuesWorkbenchSectionHeader
          title={MY_TASKS_SECTION.title}
          subtitle={MY_TASKS_SECTION.subtitle}
          count={myTasks.length}
          countVariant="recent"
          illustrationSrc={ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork}
        />
        <div className="mt-3">
          <TaskList
            tasks={myTasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            selectedPropertyIds={selectedPropertyIds}
            hidePrimaryUrgentChip
            embeddedInIssuesWorkbench
            embeddedVerticalList
            compactTaskMeta
            hideDoneSection
          />
        </div>
      </section>

      <section className="min-w-0 rounded-2xl bg-transparent py-1">
        <IssuesWorkbenchSectionHeader
          title={DUE_SOON_SECTION.title}
          subtitle={DUE_SOON_SECTION.subtitle}
          count={dueSoonTasks.length}
          countVariant="recent"
        />
        <div className="mt-3">
          <TaskList
            tasks={dueSoonTasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            selectedPropertyIds={selectedPropertyIds}
            hidePrimaryUrgentChip
            embeddedInIssuesWorkbench
            embeddedVerticalList
            compactTaskMeta
            hideDoneSection
          />
        </div>
      </section>
    </div>
  );
}
