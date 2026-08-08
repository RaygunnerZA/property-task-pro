import { useEffect, useMemo, useState } from "react";
import { MessageSquare, MessageSquareMore } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import {
  workbenchSectionTitleClassName,
} from "@/lib/workbenchSectionTitle";
import { useDataContext } from "@/contexts/DataContext";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import {
  useTaskCommentSignalsMap,
} from "@/hooks/useTaskCommentSignals";
import {
  isTaskCommentSignalNew,
  TASK_COMMENT_SEEN_EVENT,
} from "@/lib/taskCommentSeen";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  isOnboardingDemoTask,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import { cn } from "@/lib/utils";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

type TasksListTab = "all" | "urgent" | "my" | "messages";

const TASKS_LIST_TABS: {
  id: Exclude<TasksListTab, "messages">;
  label: string;
  /** Use `\n` for an intentional mobile line break (rendered with `whitespace-pre-line`). */
  subtitle: string;
  illustrationSrc: string;
}[] = [
  {
    id: "all",
    label: "All",
    subtitle:
      "Every task in scope —\nincluding completed work and work assigned to others.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.allTasks,
  },
  {
    id: "urgent",
    label: "Urgent",
    subtitle: "High-priority work that\nneeds action soon.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.urgent,
  },
  {
    id: "my",
    label: "My tasks",
    subtitle: "Work assigned to you.",
    illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.openWork,
  },
];

const MESSAGES_TAB_META = {
  id: "messages" as const,
  subtitle: "Open tasks with unread messages.",
  /** Former “All” header art — speech / conversation cue for the messages tab. */
  illustrationSrc: ISSUES_WORKBENCH_SECTION_ILLUSTRATION.recentSignals,
};

const TERMINAL_TASK_STATUSES = new Set(["completed", "archived", "done"]);
/** Cancelled only — completed work stays visible in All. */
const HIDDEN_FROM_ALL_STATUSES = new Set(["archived", "done"]);

function isOpenTask(task: { status?: string | null }) {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_TASK_STATUSES.has(status);
}

function isVisibleInAllTasks(task: { status?: string | null }) {
  const status = (task.status ?? "").toLowerCase();
  return !HIDDEN_FROM_ALL_STATUSES.has(status);
}

function filterScopedTasksForTasksTab(
  tasks: any[],
  selectedPropertyIds: Set<string> | undefined,
  properties: { id: string }[],
  memberRole: string | null | undefined,
  includeCompleted: boolean
) {
  const propertyIds = properties.map((p) => p.id);
  return tasks.filter((task) => {
    if (!taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)) return false;
    if (shouldHideOwnerDemoTaskForRole(task, memberRole)) return false;
    if (isStaffTrainingTask(task)) return false;
    if (includeCompleted) {
      if (!isVisibleInAllTasks(task)) return false;
    } else if (!isOpenTask(task)) {
      return false;
    }
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

function useTaskCommentSeenTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onSeen = () => setTick((n) => n + 1);
    window.addEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
  }, []);
  return tick;
}

/**
 * Tasks tab — single list with All / Urgent / My tasks (+ Messages when unread).
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
  const { data: latestByTask } = useTaskCommentSignalsMap();
  const seenTick = useTaskCommentSeenTick();

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
    () =>
      filterScopedTasksForTasksTab(
        tasks,
        selectedPropertyIds,
        properties,
        memberRole,
        false
      ),
    [tasks, selectedPropertyIds, properties, memberRole]
  );

  const scopedAllTasks = useMemo(
    () =>
      filterScopedTasksForTasksTab(
        tasks,
        selectedPropertyIds,
        properties,
        memberRole,
        true
      ),
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
    () => sortRecentlyAdded(scopedAllTasks),
    [scopedAllTasks]
  );

  const messageTasks = useMemo(() => {
    void seenTick;
    if (!latestByTask) return [];
    return scopedOpenTasks.filter((task) => {
      const latest = latestByTask[String(task.id)];
      if (!latest) return false;
      return isTaskCommentSignalNew({
        taskId: String(task.id),
        createdAt: latest.createdAt,
        authorUserId: latest.authorUserId,
        currentUserId: userId,
      });
    });
  }, [scopedOpenTasks, latestByTask, userId, seenTick]);

  const messagesTabVisible = messageTasks.length >= 1;

  // If unread messages clear while on the Messages tab, fall back to All.
  useEffect(() => {
    if (listTab === "messages" && !messagesTabVisible) {
      setListTab("all");
    }
  }, [listTab, messagesTabVisible]);

  const tabCounts: Record<TasksListTab, number> = {
    all: allTasks.length,
    urgent: urgentTasks.length,
    my: myTasks.length,
    messages: messageTasks.length,
  };

  const visibleTasks = useMemo(() => {
    if (listTab === "urgent") return sortRecentlyAdded(urgentTasks);
    if (listTab === "my") return sortRecentlyAdded(myTasks);
    if (listTab === "messages") return sortRecentlyAdded(messageTasks);
    return allTasks;
  }, [listTab, allTasks, urgentTasks, myTasks, messageTasks]);

  const activeTabMeta =
    listTab === "messages"
      ? MESSAGES_TAB_META
      : TASKS_LIST_TABS.find((tab) => tab.id === listTab) ?? TASKS_LIST_TABS[0];

  const MessagesIcon = messageTasks.length > 1 ? MessageSquareMore : MessageSquare;

  return (
    <div className="min-w-0">
      <section className="min-w-0 rounded-2xl bg-transparent pt-0 pb-1">
        {/*
          items-start so the illustration doesn’t push “All” down (was items-end → ~75px gap).
          CentreWorkbench owns the 55px space above this title.
        */}
        <div className="relative flex w-full min-w-0 items-start gap-3 px-2">
          <div
            className={cn(
              "min-w-0 flex-1",
              listTab === "all"
                ? "pr-[min(6.6rem,28%)] md:pr-[min(7.8rem,33%)]"
                : "pr-[min(5.5rem,24%)] md:pr-[min(6.5rem,28%)]"
            )}
          >
            <div
              role="tablist"
              aria-label="Task lists"
              className="flex min-w-0 flex-nowrap items-center gap-x-1.5 md:gap-x-2"
            >
              {TASKS_LIST_TABS.map((tab, index) => {
                const selected = listTab === tab.id;
                const count = tabCounts[tab.id];
                return (
                  <div
                    key={tab.id}
                    className="flex shrink-0 items-center gap-x-1.5 md:gap-x-2"
                  >
                    {index > 0 ? (
                      <span
                        className="text-lg font-normal leading-tight text-muted-foreground/35 md:text-xl"
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
                        "inline-flex items-center gap-1 whitespace-nowrap text-lg leading-tight tracking-tight transition-colors md:gap-1.5 md:text-xl",
                        selected
                          ? cn(
                              workbenchSectionTitleClassName,
                              "text-lg text-foreground md:text-xl"
                            )
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

              {messagesTabVisible ? (
                <div className="flex shrink-0 items-center gap-x-1.5 md:gap-x-2">
                  <span
                    className="text-lg font-normal leading-tight text-muted-foreground/35 md:text-xl"
                    aria-hidden
                  >
                    |
                  </span>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listTab === "messages"}
                    aria-label={`Messages, ${tabCounts.messages} unread`}
                    onClick={() => setListTab("messages")}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap text-lg leading-tight tracking-tight transition-colors md:gap-1.5 md:text-xl",
                      listTab === "messages"
                        ? cn(
                            workbenchSectionTitleClassName,
                            "text-lg text-foreground md:text-xl"
                          )
                        : "font-normal text-muted-foreground/50 hover:text-muted-foreground"
                    )}
                  >
                    <MessagesIcon
                      className="h-[calc(1.3cap+4px)] w-[calc(1.3cap+4px)] shrink-0 translate-y-[1px]"
                      strokeWidth={listTab === "messages" ? 2.25 : 2}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/80 px-1 text-2xs font-medium tabular-nums",
                        listTab === "messages"
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {tabCounts.messages}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-snug text-muted-foreground md:whitespace-normal">
              {activeTabMeta.subtitle}
            </p>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute right-2 top-0 flex aspect-square items-start justify-end",
              // All-tasks art: +20% vs other tab illustrations (grows upward from the header).
              listTab === "all"
                ? "mt-[-6px] w-[min(6.3rem,26%)] max-h-[6.3rem] md:w-[min(7.5rem,31%)] md:max-h-[7.5rem]"
                : "w-[min(5.25rem,22%)] max-h-[5.25rem] md:w-[min(6.25rem,26%)] md:max-h-[6.25rem]"
            )}
            aria-hidden
          >
            <img
              key={activeTabMeta.illustrationSrc}
              src={activeTabMeta.illustrationSrc}
              alt=""
              className="mt-[-2px] h-full w-full overflow-hidden object-contain object-top drop-shadow-sm"
              decoding="async"
            />
          </div>
        </div>

        <div className="mt-3 px-2 md:mt-5 md:mb-5">
          <WorkbenchTaskFilterBar
            tasks={tasks}
            properties={properties}
            hidePrimaryQuickChips
            showSortBar
          />
        </div>

        <div className="mt-3 px-2 md:mt-0">
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
            hideDoneSection={listTab !== "all"}
          />
        </div>
      </section>
    </div>
  );
}
