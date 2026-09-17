import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, MessageSquareMore } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { TasksMessagesCardGrid } from "@/components/workbench/TasksMessagesCardGrid";
import { ISSUES_WORKBENCH_SECTION_ILLUSTRATION } from "@/lib/issuesWorkbenchSectionIllustrations";
import { useAllTasksIllustrationSrc } from "@/hooks/useAllTasksIllustration";
import {
  WORKBENCH_CENTRE_TAB_ACTIVE_COLOR,
  WORKBENCH_CENTRE_TAB_INACTIVE_COLOR,
  workbenchCentreTabActiveClassName,
  workbenchCentreTabInactiveClassName,
  workbenchTitleBandLabelOffsetClassName,
  workbenchTitleBandPtClassName,
} from "@/lib/workbenchSectionTitle";
import { useDataContext } from "@/contexts/DataContext";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { useAutoUrgentPreference } from "@/hooks/useAutoUrgentPreference";
import { isTaskEffectivelyUrgent } from "@/lib/autoUrgent";
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
  latestByTask: Record<string, { createdAt: string; isUnread?: boolean }>
) {
  return [...tasks].sort((a, b) => {
    const aPreview = latestByTask[String(a.id)];
    const bPreview = latestByTask[String(b.id)];
    const aUnread = Boolean(aPreview?.isUnread);
    const bUnread = Boolean(bPreview?.isUnread);
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    const aAt = aPreview?.createdAt ?? a.created_at ?? 0;
    const bAt = bPreview?.createdAt ?? b.created_at ?? 0;
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
  const { setSelectedFilters, selectedFilters, sortBy, searchQuery, clearAllFilters } =
    useWorkbenchControls();
  const { mode: identityMode } = useIdentityMode();
  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";
  const [listTab, setListTab] = useState<TasksListTab>("all");
  const [listEpoch, setListEpoch] = useState(0);
  const [authorFilterKey, setAuthorFilterKey] = useState<string | null>(null);
  const { latestByTask, recentAuthors } = useTaskMessageActivity();
  const allTasksIllustrationSrc = useAllTasksIllustrationSrc();
  const { horizonId: autoUrgentHorizon } = useAutoUrgentPreference();
  const headerRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const [hideHeaderArt, setHideHeaderArt] = useState(false);

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
    () => scopedOpenTasks.filter((t) => isTaskEffectivelyUrgent(t, autoUrgentHorizon)),
    [scopedOpenTasks, autoUrgentHorizon]
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

  /** Authors for the Messages filter strip — unread authors first, then newest. */
  const scopedMessageAuthors = useMemo(() => {
    const seen = new Set<string>();
    const authors: typeof recentAuthors = [];
    const orderedTasks = sortByLatestMessage(messageTasks, latestByTask);
    for (const task of orderedTasks) {
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
      autoUrgentHorizon,
    });
    // Default Messages order: new (unread) first, then most recent message.
    // Other sorts override that.
    if (sortBy !== "recent") {
      list = sortTasksByWorkbenchSort(list, sortBy);
    } else {
      list = sortByLatestMessage(list, latestByTask);
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
    autoUrgentHorizon,
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
  const activeIllustrationSrc =
    listTab === "all" ? allTasksIllustrationSrc : activeTabMeta.illustrationSrc;

  useLayoutEffect(() => {
    const header = headerRef.current;
    const tabs = tablistRef.current;
    if (!header || !tabs) return;

    const measure = () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        setHideHeaderArt(true);
        return;
      }
      const headerRect = header.getBoundingClientRect();
      const tabButtons = tabs.querySelectorAll('[role="tab"]');
      const lastTab = tabButtons[tabButtons.length - 1] ?? tabs;
      const tabsRight = lastTab.getBoundingClientRect().right;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const maxArt = (listTab === "all" ? 7.5 : 6.25) * rem;
      const pct = listTab === "all" ? 0.31 : 0.26;
      const artWidth = Math.min(maxArt, headerRect.width * pct);
      const artInset = 8;
      const gap = 12;
      const slack = 16;
      const artLeft = headerRect.right - artInset - artWidth;
      setHideHeaderArt((hidden) => {
        const overlaps = tabsRight + gap > artLeft;
        if (!hidden) return overlaps;
        // Stay hidden until there is clear space — measuring the last tab
        // (not the stretched tablist box) so widening can show the art again.
        return tabsRight + gap + slack > artLeft;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    ro.observe(tabs);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [listTab, activeIllustrationSrc, tabCounts.all, tabCounts.urgent, tabCounts.my]);

  const MessagesIcon = unreadMessageCount > 1 ? MessageSquareMore : MessageSquare;

  const handleSelectTaskFromMessages = (taskId: string) => {
    window.dispatchEvent(
      new CustomEvent("filla:open-task-from-messages", { detail: { taskId } })
    );
  };

  /** List tabs are primary views — choosing one drops the filter bar and reloads that list. */
  const selectListTab = useCallback(
    (next: TasksListTab) => {
      clearAllFilters();
      setAuthorFilterKey(null);
      setListTab(next);
      setListEpoch((n) => n + 1);
    },
    [clearAllFilters]
  );

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-col">
      <section className="flex min-h-0 min-w-0 w-full flex-col rounded-2xl bg-transparent pt-0 pb-1">
        {/* Align All / Urgent / My with left-rail section H1 (shared title-band pt). */}
        <div
          ref={headerRef}
          className={cn(
            "relative flex w-full min-w-0 items-start gap-3 px-0",
            workbenchTitleBandPtClassName
          )}
        >
          <div
            className={cn(
              "min-w-0 flex-1",
              workbenchTitleBandLabelOffsetClassName,
              !hideHeaderArt &&
                (listTab === "all"
                  ? "md:pr-[min(7.8rem,33%)]"
                  : "md:pr-[min(6.5rem,28%)]")
            )}
          >
            <div
              ref={tablistRef}
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
                        className="font-display text-2xl font-light leading-tight text-muted-foreground/35"
                        aria-hidden
                      >
                        |
                      </span>
                    ) : null}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => selectListTab(tab.id)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap transition-colors md:gap-1.5",
                        selected
                          ? workbenchCentreTabActiveClassName
                          : workbenchCentreTabInactiveClassName
                      )}
                      style={{
                        color: selected
                          ? WORKBENCH_CENTRE_TAB_ACTIVE_COLOR
                          : WORKBENCH_CENTRE_TAB_INACTIVE_COLOR,
                      }}
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
                  className="font-display text-2xl font-light leading-tight text-muted-foreground/35"
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
                  onClick={() => selectListTab("messages")}
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap transition-colors md:gap-1.5",
                    listTab === "messages"
                      ? workbenchCentreTabActiveClassName
                      : workbenchCentreTabInactiveClassName
                  )}
                  style={{
                    color:
                      listTab === "messages"
                        ? WORKBENCH_CENTRE_TAB_ACTIVE_COLOR
                        : WORKBENCH_CENTRE_TAB_INACTIVE_COLOR,
                  }}
                >
                  <MessagesIcon
                    className="icon-shadow-neu-pressed h-[calc(1.3cap+4px)] w-[calc(1.3cap+4px)] shrink-0 translate-y-[1px]"
                    strokeWidth={listTab === "messages" ? 2 : 1.75}
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
              "pointer-events-none absolute right-2 top-0 aspect-square items-start justify-end",
              workbenchTitleBandPtClassName,
              hideHeaderArt ? "hidden" : "hidden md:flex",
              // All-tasks art: +20% vs other tab illustrations (grows upward from the header).
              listTab === "all"
                ? "mt-[-6px] md:w-[min(7.5rem,31%)] md:max-h-[7.5rem]"
                : "md:w-[min(6.25rem,26%)] md:max-h-[6.25rem]"
            )}
            aria-hidden
          >
            <img
              key={activeIllustrationSrc}
              src={activeIllustrationSrc}
              alt=""
              className="mt-[-2px] h-full w-full overflow-hidden object-contain object-top drop-shadow-sm"
              decoding="async"
            />
          </div>
        </div>

        <div className="mt-3 px-0 md:mt-5 md:mb-5">
          <WorkbenchTaskFilterBar
            key={`task-filters-${listEpoch}`}
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

        {/* List is in document flow — page scroll moves left · centre · right together. */}
        <div className="mt-3 px-0 pb-4 pt-0.5 md:mt-0">
          {listTab === "messages" ? (
            <TasksMessagesCardGrid
              key={`task-messages-${listEpoch}`}
              tasks={visibleTasks}
              properties={properties}
              selectedTaskId={selectedTaskId}
              onTaskClick={handleSelectTaskFromMessages}
              messagePreviewsByTaskId={latestByTask}
            />
          ) : (
            <TaskList
              key={`task-list-${listTab}-${listEpoch}`}
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
        </div>
      </section>
    </div>
  );
}
