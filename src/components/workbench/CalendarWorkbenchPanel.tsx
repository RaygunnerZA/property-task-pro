import { useCallback, useMemo, useState } from "react";
import {
  addMonths,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { SegmentControl, type SegmentOption } from "@/components/filla";
import { Button } from "@/components/ui/button";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useUpdateTaskMutation } from "@/hooks/mutations/useUpdateTaskMutation";
import { useToast } from "@/hooks/use-toast";
import {
  applyCalendarDisplayFilters,
  filterTasksForCalendar,
} from "@/lib/calendarDayMeta";
import { CALENDAR_TYPES, type CalendarTypeId } from "@/lib/calendarTypes";
import { cn } from "@/lib/utils";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

type WorkspaceCalendarView = "calendar" | "schedule";

const VIEW_OPTIONS: SegmentOption[] = [
  { id: "calendar", label: "Calendar" },
  { id: "schedule", label: "Schedule" },
];

export type CalendarWorkbenchPanelProps = MyWorkPanelProps & {
  selectedDate?: Date;
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
}: CalendarWorkbenchPanelProps) {
  const { userId } = useDataContext();
  const { orgId } = useActiveOrg();
  const workbenchControls = useOptionalWorkbenchControls();
  const updateTaskMutation = useUpdateTaskMutation();
  const { toast } = useToast();

  const [view, setView] = useState<WorkspaceCalendarView>("calendar");
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedCalendarTypes] = useState<Set<CalendarTypeId>>(
    () => new Set(CALENDAR_TYPES.map((t) => t.id))
  );

  const selectedDate = selectedDateProp ?? internalSelectedDate;

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

  const displayTasks = useMemo(() => {
    const scoped = filterTasksForCalendar(parsedTasks, {
      selectedPropertyIds: effectivePropertyIds,
      allPropertyIds,
      selectedCalendarTypes,
    });
    return applyCalendarDisplayFilters(scoped, {
      searchQuery: workbenchControls?.searchQuery ?? "",
      propertyMap,
      selectedWorkbenchFilters: workbenchControls?.selectedFilters,
      userId,
    });
  }, [
    parsedTasks,
    effectivePropertyIds,
    allPropertyIds,
    selectedCalendarTypes,
    workbenchControls?.searchQuery,
    workbenchControls?.selectedFilters,
    propertyMap,
    userId,
  ]);

  const scheduleTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return displayTasks
      .filter((task: any) => {
        const status = task.status?.toLowerCase();
        if (status === "completed" || status === "done" || status === "cancelled") return false;
        if (!task.due_date) return false;
        const due = startOfDay(new Date(task.due_date));
        return isAfter(due, subDays(today, 1));
      })
      .sort(
        (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );
  }, [displayTasks]);

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
    <div className="flex min-h-0 flex-col space-y-4">
      <SegmentControl
        options={VIEW_OPTIONS}
        selectedId={view}
        onChange={(id) => setView(id as WorkspaceCalendarView)}
        className="w-full max-w-xs"
      />

      {view === "calendar" ? (
        <section className="flex min-h-0 flex-col gap-3">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40",
              "bg-card px-3 py-2.5 shadow-e1"
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
        <section className="-mt-4 flex min-h-0 flex-1 flex-col">
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
                showDateHeaders={false}
              />
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 text-center">
                <Calendar className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="mb-1 text-sm font-medium text-foreground">
                  {`No tasks scheduled for ${format(selectedDate, "EEEE, MMMM d")}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Create a task with a due date to see it in your agenda.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
