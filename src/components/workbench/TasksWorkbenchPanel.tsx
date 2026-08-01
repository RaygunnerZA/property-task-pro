import { useEffect, useMemo, useState } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import {
  workbenchSectionTitleClassName,
} from "@/lib/workbenchSectionTitle";
import { useDataContext } from "@/contexts/DataContext";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  isOnboardingDemoTask,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import { cn } from "@/lib/utils";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

type TasksListTab = "all" | "urgent" | "my";

const TASKS_LIST_TABS: {
  id: TasksListTab;
  label: string;
  subtitle: string;
  illustrationSrc: string;
}[] = [
  {
    id: "all",
    label: "All",
    subtitle: "Every open task in scope — including work assigned to others, newest first.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.recentSignals,
  },
  {
    id: "urgent",
    label: "Urgent",
    subtitle: "High-priority work that needs action soon.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.urgent,
  },
  {
    id: "my",
    label: "My tasks",
    subtitle: "Work assigned to you.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork,
  },
];

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

function sortRecentlyAdded(tasks: any[]) {
  return [...tasks].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );
}

/**
 * Tasks tab — single list with All / Urgent / My tasks tabs.
 * All (default) is sorted by recently added; includes work assigned to others.
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
  const { setSelectedFilters } = useWorkbenchControls();
  const { mode: identityMode } = useIdentityMode();
  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";
  const [listTab, setListTab] = useState<TasksListTab>("all");

  // List tabs replace Due / Urgent / My Tasks chips — clear them so they don't double-filter.
  useEffect(() => {
    setSelectedFilters((prev) => {
      if (
        !prev.has("filter-due") &&
        !prev.has("filter-urgent") &&
        !prev.has("filter-assigned-me")
      ) {
        return prev;
      }
      const next = new Set(prev);
      next.delete("filter-due");
      next.delete("filter-urgent");
      next.delete("filter-assigned-me");
      return next;
    });
  }, [setSelectedFilters]);

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

  const allTasks = useMemo(
    () => sortRecentlyAdded(scopedOpenTasks),
    [scopedOpenTasks]
  );

  const tabCounts: Record<TasksListTab, number> = {
    all: allTasks.length,
    urgent: urgentTasks.length,
    my: myTasks.length,
  };

  const visibleTasks = useMemo(() => {
    if (listTab === "urgent") return sortRecentlyAdded(urgentTasks);
    if (listTab === "my") return sortRecentlyAdded(myTasks);
    return allTasks;
  }, [listTab, allTasks, urgentTasks, myTasks]);

  const activeTabMeta =
    TASKS_LIST_TABS.find((tab) => tab.id === listTab) ?? TASKS_LIST_TABS[0];

  return (
    <div className="min-w-0 -mt-[30px]">
      <section className="min-w-0 rounded-2xl bg-transparent pb-1 pt-0">
        <div className="flex w-full min-w-0 items-end gap-3 px-2">
          <div
            role="tablist"
            aria-label="Task lists"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
          >
            {TASKS_LIST_TABS.map((tab, index) => {
              const selected = listTab === tab.id;
              const count = tabCounts[tab.id];
              return (
                <div key={tab.id} className="flex items-center gap-x-2">
                  {index > 0 ? (
                    <span
                      className="text-xl font-normal leading-tight text-muted-foreground/35"
                      aria-hidden
                    >
                      |
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setListTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xl leading-tight tracking-tight transition-colors",
                      selected
                        ? cn(workbenchSectionTitleClassName, "text-foreground")
                        : "font-normal text-muted-foreground/50 hover:text-muted-foreground"
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/80 px-1 text-2xs font-medium tabular-nums",
                        selected ? "text-muted-foreground" : "text-muted-foreground/60"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className="flex aspect-square w-[min(6.5rem,28%)] max-h-[6.5rem] shrink-0 translate-y-[30px] items-end justify-end"
            aria-hidden
          >
            <img
              key={activeTabMeta.illustrationSrc}
              src={activeTabMeta.illustrationSrc}
              alt=""
              className="mb-[-2px] mt-[-2px] h-full w-full overflow-hidden object-contain object-bottom drop-shadow-sm"
              decoding="async"
            />
          </div>
        </div>

        <p className="mt-2 px-2 text-sm leading-snug text-muted-foreground">
          {activeTabMeta.subtitle}
        </p>

        <div className="mt-5 mb-5 px-2">
          <WorkbenchTaskFilterBar
            tasks={tasks}
            properties={properties}
            hidePrimaryQuickChips
            showSortBar
          />
        </div>

        <div className="px-2">
          <TaskList
            tasks={visibleTasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={onTaskClick}
            selectedTaskId={selectedTaskId}
            selectedPropertyIds={selectedPropertyIds}
            hidePrimaryUrgentChip
            embeddedInIssuesWorkbench
            embeddedVerticalList
            embeddedColumns={2}
            compactTaskMeta
            hideDoneSection
          />
        </div>
      </section>
    </div>
  );
}
