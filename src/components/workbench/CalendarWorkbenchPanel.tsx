import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { Button } from "@/components/ui/button";
import {
  WorkbenchTaskFilterBar,
  type CalendarListScope,
} from "@/components/workbench/WorkbenchTaskFilterBar";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useUpdateTaskMutation } from "@/hooks/mutations/useUpdateTaskMutation";
import { useToast } from "@/hooks/use-toast";
import {
  applyCalendarDisplayFilters,
  filterTasksForCalendar,
  type CalendarTaskScope,
} from "@/lib/calendarDayMeta";
import { filterTasksForScheduleAgenda } from "@/lib/calendarTaskSchedule";
import { CALENDAR_TYPES, type CalendarTypeId } from "@/lib/calendarTypes";
import { workbenchSectionTitleClassName } from "@/lib/workbenchSectionTitle";
import { cn } from "@/lib/utils";
import type { CentreCalendarView } from "@/lib/centreWorkbenchTabs";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

type WorkspaceCalendarView = "calendar" | "schedule";

const VIEW_TABS: {
  id: WorkspaceCalendarView;
  label: string;
  subtitle: string;
}[] = [
  {
    id: "calendar",
    label: "Calendar",
    subtitle: "Month view of due dates, repeats, and milestones.",
  },
  {
    id: "schedule",
    label: "Schedule",
    subtitle: "Upcoming work from today — including milestones. Use filters to narrow the list.",
  },
];

export type CalendarWorkbenchPanelProps = MyWorkPanelProps & {
  selectedDate?: Date;
  initialCalendarView?: CentreCalendarView;
};

/**
 * Centre workbench Calendar tab — month grid (same as `/calendar`) + Schedule agenda.
 */
export function CalendarWorkbenchPanel({
  tasks: tasksProp = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  selectedTaskId,
  selectedPropertyIds,
  selectedDate: selectedDateProp,
  initialCalendarView = "calendar",
}: CalendarWorkbenchPanelProps) {
  const { userId } = useDataContext();
  const { orgId } = useActiveOrg();
  const workbenchControls = useOptionalWorkbenchControls();
  const updateTaskMutation = useUpdateTaskMutation();
  const { toast } = useToast();

  const [view, setView] = useState<WorkspaceCalendarView>(initialCalendarView);

  useEffect(() => {
    setView(initialCalendarView);
  }, [initialCalendarView]);
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedCalendarTypes] = useState<Set<CalendarTypeId>>(
    () => new Set(CALENDAR_TYPES.map((t) => t.id))
  );
  const [listScope, setListScope] = useState<CalendarListScope>(() =>
    workbenchControls?.selectedFilters?.has("filter-assigned-me") ? "mine" : "all"
  );

  const selectedDate = selectedDateProp ?? internalSelectedDate;
  const activeViewMeta = VIEW_TABS.find((tab) => tab.id === view) ?? VIEW_TABS[0];

  useEffect(() => {
    if (!selectedDateProp) return;
    setInternalSelectedDate(selectedDateProp);
    setCurrentMonth(startOfMonth(selectedDateProp));
  }, [selectedDateProp]);

  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const effectivePropertyIds = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0) {
      return new Set(allPropertyIds);
    }
    return selectedPropertyIds;
  }, [selectedPropertyIds, allPropertyIds]);

  const parsedTasks = useMemo(
    () =>
      tasksProp.map((task: any) => ({
        ...task,
        spaces:
          typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [],
        themes:
          typeof task.themes === "string" ? JSON.parse(task.themes) : task.themes || [],
        teams: typeof task.teams === "string" ? JSON.parse(task.teams) : task.teams || [],
      })),
    [tasksProp]
  );

  const propertyMap = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p]));
    parsedTasks.forEach((task: any) => {
      if (task.property_id && task.property_name && !map.has(task.property_id)) {
        map.set(task.property_id, {
          id: task.property_id,
          nickname: task.property_name,
          address: task.property_address || "",
        });
      }
    });
    return map;
  }, [properties, parsedTasks]);

  const taskScope: CalendarTaskScope = listScope === "mine" ? "mine" : "all";

  const displayFilters = useMemo(() => {
    const next = new Set(workbenchControls?.selectedFilters ?? []);
    next.delete("filter-assigned-me");
    next.delete("filter-urgent");
    next.delete("filter-due");
    if (listScope === "urgent") next.add("filter-urgent");
    return next;
  }, [workbenchControls?.selectedFilters, listScope]);

  const displayTasks = useMemo(() => {
    const scoped = filterTasksForCalendar(parsedTasks, {
      selectedPropertyIds: effectivePropertyIds,
      allPropertyIds,
      selectedCalendarTypes,
    });
    return applyCalendarDisplayFilters(scoped, {
      searchQuery: workbenchControls?.searchQuery ?? "",
      propertyMap,
      selectedWorkbenchFilters: displayFilters,
      userId,
      taskScope,
    });
  }, [
    parsedTasks,
    effectivePropertyIds,
    allPropertyIds,
    selectedCalendarTypes,
    workbenchControls?.searchQuery,
    displayFilters,
    propertyMap,
    userId,
    taskScope,
  ]);

  /** Agenda from today forward (plus overdue), limited by All / Urgent / My filters. */
  const scheduleTasks = useMemo(
    () => filterTasksForScheduleAgenda(displayTasks),
    [displayTasks]
  );

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    setInternalSelectedDate(date);
    setCurrentMonth(startOfMonth(date));
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setInternalSelectedDate(today);
    setCurrentMonth(startOfMonth(today));
  }, []);

  const handleTaskReschedule = useCallback(
    async (
      taskId: string,
      updates: {
        due_date?: string | null;
        milestones?: Array<{ id: string; dateTime: string; label?: string }>;
      }
    ) => {
      const task = displayTasks.find((t: { id: string }) => t.id === taskId) as
        | { org_id?: string; property_id?: string | null }
        | undefined;
      const resolvedOrgId = task?.org_id ?? orgId;
      if (!resolvedOrgId) return;

      try {
        await updateTaskMutation.mutateAsync({
          taskId,
          orgId: resolvedOrgId,
          propertyId: task?.property_id ?? null,
          updates: updates as Parameters<typeof updateTaskMutation.mutateAsync>[0]["updates"],
        });
      } catch (err) {
        toast({
          title: "Couldn't move task",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      }
    },
    [displayTasks, orgId, updateTaskMutation, toast]
  );

  return (
    <div className="min-w-0 flex min-h-0 flex-1 flex-col pt-0">
      <section className="min-w-0 rounded-2xl bg-transparent pt-0 pb-1">
        <div className="relative flex w-full min-w-0 items-start gap-3 px-2">
          <div className="min-w-0 flex-1">
            <div
              role="tablist"
              aria-label="Calendar views"
              className="flex min-w-0 flex-nowrap items-center gap-x-1.5 md:gap-x-2"
            >
              {VIEW_TABS.map((tab, index) => {
                const selected = view === tab.id;
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
                      onClick={() => setView(tab.id)}
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
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-snug text-muted-foreground md:whitespace-normal">
              {activeViewMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-3 px-2 md:mt-5 md:mb-5">
          <WorkbenchTaskFilterBar
            tasks={tasksProp}
            properties={properties}
            calendarListScope={{ value: listScope, onChange: setListScope }}
            showSortBar
          />
        </div>
      </section>

      {view === "calendar" ? (
        <section className="flex min-h-0 flex-col gap-3 px-2">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-xl",
              "bg-transparent py-[3px]"
            )}
          >
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4 text-accent" />
              </button>
              <CalendarMonthYearLabel
                date={currentMonth}
                className="min-w-[88px] justify-center"
              />
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4 text-accent" />
              </button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
          </div>

          <div className="min-h-[420px] overflow-hidden rounded-xl bg-card/60 p-1 shadow-sm sm:min-h-[520px]">
            {tasksLoading ? (
              <div className="space-y-3 p-4">
                <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
                <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
              </div>
            ) : (
              <CalendarMonthGrid
                month={currentMonth}
                tasks={displayTasks}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onTaskClick={onTaskClick}
                onTaskReschedule={handleTaskReschedule}
                selectedTaskId={selectedTaskId}
                propertyMap={propertyMap}
              />
            )}
          </div>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col px-2">
          <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl bg-muted/10">
            {tasksLoading ? (
              <div className="space-y-3 p-4">
                <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
                <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
              </div>
            ) : scheduleTasks.length > 0 ? (
              <ScheduleView
                tasks={scheduleTasks}
                properties={properties}
                selectedDate={selectedDate}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedTaskId}
              />
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 text-center">
                <Calendar className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="mb-1 text-sm font-medium text-foreground">
                  No scheduled tasks
                </p>
                <p className="text-xs text-muted-foreground">
                  Create a task with a due date, or adjust All / Urgent / My tasks filters.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
