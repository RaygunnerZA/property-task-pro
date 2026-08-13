import { useEffect, useMemo, useState } from "react";
import { MessageSquare, MessageSquareMore } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { TasksMessagesCardGrid } from "@/components/workbench/TasksMessagesCardGrid";
import { MagneticScrollArea } from "@/components/ui/MagneticScrollArea";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import {
  workbenchSectionTitleClassName,
} from "@/lib/workbenchSectionTitle";
import { useDataContext } from "@/contexts/DataContext";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { useTaskMessageActivity } from "@/hooks/useTaskMessageActivity";
import { setTasksMessagesTabActive } from "@/lib/tasksMessagesTab";
import {
  filterTasksByWorkbenchFilters,
  sortTasksByWorkbenchSort,
} from "@/lib/workbenchTaskListFilters";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  isOnboardingDemoTask,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import type { CalendarTaskScope } from "@/lib/calendarDayMeta";
import { cn } from "@/lib/utils";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

type TasksListTab = "all" | "urgent" | "my" | "messages";

export type TasksWorkbenchPanelProps = MyWorkPanelProps & {
  /** Keeps phone/mini calendars aligned with All vs My tasks. */
  onCalendarTaskScopeChange?: (scope: CalendarTaskScope) => void;
};

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
  subtitle: "Conversations on open tasks — always available here.",
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

function sortByLatestMessage(
  tasks: any[],
  latestByTask: Record<string, { createdAt: string }>
) {
  return [...tasks].sort((a, b) => {
    const aAt = latestByTask[String(a.id)]?.createdAt ?? a.created_at ?? 0;
    const bAt = latestByTask[String(b.id)]?.createdAt ?? b.created_at ?? 0;
    return new Date(bAt).getTime() - new Date(aAt).getTime();
  });
}

/**
 * Tasks tab — All / Urgent / My tasks / Messages (always available).
 * All (default) is sorted by recently added; includes work assigned to others.
 */
export function TasksWorkbenchPanel({
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  selectedTaskId,
  selectedPropertyIds,
  onCalendarTaskScopeChange,
}: TasksWorkbenchPanelProps) {
  const { userId } = useDataContext();
  const { setSelectedFilters, selectedFilters, sortBy, searchQuery } = useWorkbenchControls();
  const { mode: identityMode } = useIdentityMode();
  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";
  const [listTab, setListTab] = useState<TasksListTab>("all");
  const [authorFilterKey, setAuthorFilterKey] = useState<string | null>(null);
  const { latestByTask, recentAuthors } = useTaskMessageActivity();

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

  // Keep calendars in sync: All → everyone's tasks/milestones; My tasks → assigned to me only.
  useEffect(() => {
    if (!onCalendarTaskScopeChange) return;
    if (listTab === "my") onCalendarTaskScopeChange("mine");
    else if (listTab === "all") onCalendarTaskScopeChange("all");
  }, [listTab, onCalendarTaskScopeChange]);

  // Collapse Create Task / Add Record + Add to Filla while Messages is active.
  useEffect(() => {
    const active = listTab === "messages";
    setTasksMessagesTabActive(active);
    return () => {
      if (active) setTasksMessagesTabActive(false);
    };
  }, [listTab]);

  useEffect(() => {
    if (listTab !== "messages") setAuthorFilterKey(null);
  }, [listTab]);

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

  /** Open tasks that have any recent message activity (not only unread). */
  const messageTasks = useMemo(() => {
    const withMessages = scopedOpenTasks.filter(
      (task) => Boolean(latestByTask[String(task.id)])
    );
    return sortByLatestMessage(withMessages, latestByTask);
  }, [scopedOpenTasks, latestByTask]);

  const unreadMessageCount = useMemo(
    () => messageTasks.filter((t) => latestByTask[String(t.id)]?.isUnread).length,
    [messageTasks, latestByTask]
  );

  /** Authors for the Messages filter strip — scoped to visible message tasks, unique, newest first. */
  const scopedMessageAuthors = useMemo(() => {
    const seen = new Set<string>();
    const authors: typeof recentAuthors = [];
    for (const task of messageTasks) {
      const preview = latestByTask[String(task.id)];
      if (!preview) continue;
      const key = preview.authorUserId ?? `name:${preview.authorName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      authors.push({
        authorKey: key,
        authorUserId: preview.authorUserId,
        authorName: preview.authorName,
        authorAvatarUrl: preview.authorAvatarUrl,
        accentColor: preview.accentColor,
      });
    }
    return authors.length > 0 ? authors : recentAuthors;
  }, [messageTasks, latestByTask, recentAuthors]);

  const filteredMessageTasks = useMemo(() => {
    let list = messageTasks;
    if (authorFilterKey) {
      list = list.filter((task) => {
        const preview = latestByTask[String(task.id)];
        if (!preview) return false;
        const key = preview.authorUserId ?? `name:${preview.authorName}`;
        return key === authorFilterKey;
      });
    }
    list = filterTasksByWorkbenchFilters(list, selectedFilters, {
      userId,
      properties,
      selectedPropertyIds,
      searchQuery,
    });
    // "recent" on Messages = latest message order (already applied). Other sorts override.
    if (sortBy !== "recent") {
      list = sortTasksByWorkbenchSort(list, sortBy);
    }
    return list;
  }, [
    messageTasks,
    authorFilterKey,
    latestByTask,
    selectedFilters,
    userId,
    properties,
    selectedPropertyIds,
    searchQuery,
    sortBy,
  ]);

  const tabCounts: Record<Exclude<TasksListTab, "messages">, number> = {
    all: allTasks.length,
    urgent: urgentTasks.length,
    my: myTasks.length,
  };

  const visibleTasks = useMemo(() => {
    if (listTab === "urgent") return sortRecentlyAdded(urgentTasks);
    if (listTab === "my") return sortRecentlyAdded(myTasks);
    if (listTab === "messages") return filteredMessageTasks;
    return allTasks;
  }, [listTab, allTasks, urgentTasks, myTasks, filteredMessageTasks]);

  const activeTabMeta =
    listTab === "messages"
      ? MESSAGES_TAB_META
      : TASKS_LIST_TABS.find((tab) => tab.id === listTab) ?? TASKS_LIST_TABS[0];

  const MessagesIcon = unreadMessageCount > 1 ? MessageSquareMore : MessageSquare;

  const handleSelectTaskFromMessages = (taskId: string) => {
    window.dispatchEvent(
      new CustomEvent("filla:open-task-from-messages", { detail: { taskId } })
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-transparent pt-0 pb-1">
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
                  aria-label={
                    unreadMessageCount > 0
                      ? `Messages, ${unreadMessageCount} unread`
                      : "Messages"
                  }
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
                    {unreadMessageCount}
                  </span>
                </button>
              </div>
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
            messagesMode={listTab === "messages"}
            messageAuthors={scopedMessageAuthors}
            selectedMessageAuthorKey={authorFilterKey}
            onSelectMessageAuthor={setAuthorFilterKey}
          />
        </div>

        {/* Only the list scrolls — header/tabs/filters above stay put. */}
        <MagneticScrollArea className="mt-3 min-h-0 flex-1 md:mt-0" viewportClassName="px-2 pt-0.5 pb-4">
          {listTab === "messages" ? (
            <TasksMessagesCardGrid
              tasks={visibleTasks}
              properties={properties}
              selectedTaskId={selectedTaskId}
              onTaskClick={handleSelectTaskFromMessages}
              messagePreviewsByTaskId={latestByTask}
            />
          ) : (
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
          )}
        </MagneticScrollArea>
      </section>
    </div>
  );
}
