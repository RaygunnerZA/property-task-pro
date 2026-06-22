import { useCallback, useEffect, useMemo, useState } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import {
  WorkbenchGradientHeader,
  createGradientHeaderStyle,
} from "@/components/layout/WorkbenchGradientHeader";
import { CalendarLeftColumn } from "@/components/calendar/CalendarLeftColumn";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import {
  CalendarToolbar,
  type CalendarViewMode,
} from "@/components/calendar/CalendarToolbar";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { WorkbenchControlsProvider, useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUpdateTaskMutation } from "@/hooks/mutations/useUpdateTaskMutation";
import { useToast } from "@/hooks/use-toast";
import {
  applyCalendarDisplayFilters,
  filterTasksForCalendar,
} from "@/lib/calendarDayMeta";
import type { CalendarTypeId } from "@/lib/calendarTypes";
import { CALENDAR_TYPES } from "@/lib/calendarTypes";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { startOfMonth } from "date-fns";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

const LG_BREAKPOINT = LAYOUT_BREAKPOINTS.layout;
const PRIMARY_COLOR = "#8EC9CE";

function CalendarPageContent() {
  const { data: tasksData = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  const { userId } = useDataContext();
  const { orgId } = useActiveOrg();
  const { searchQuery, selectedFilters } = useWorkbenchControls();
  const { openAssistant, onSendMessage } = useAssistantContext();
  const updateTaskMutation = useUpdateTaskMutation();
  const { toast } = useToast();

  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedCalendarTypes, setSelectedCalendarTypes] = useState<Set<CalendarTypeId>>(
    () => new Set(CALENDAR_TYPES.map((t) => t.id))
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= LG_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (properties.length === 0) return;
    setSelectedPropertyIds((prev) =>
      prev.size === 0 ? new Set(properties.map((p) => p.id)) : prev
    );
  }, [properties]);

  const tasks = useMemo(
    () =>
      tasksData.map((task: any) => ({
        ...task,
        spaces:
          typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [],
        themes:
          typeof task.themes === "string" ? JSON.parse(task.themes) : task.themes || [],
        teams: typeof task.teams === "string" ? JSON.parse(task.teams) : task.teams || [],
      })),
    [tasksData]
  );

  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const propertyMap = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p]));
    tasksData.forEach((task: any) => {
      if (task.property_id && task.property_name && !map.has(task.property_id)) {
        map.set(task.property_id, {
          id: task.property_id,
          nickname: task.property_name,
          address: task.property_address || "",
        });
      }
    });
    return map;
  }, [properties, tasksData]);

  const displayTasks = useMemo(() => {
    const scoped = filterTasksForCalendar(tasks, {
      selectedPropertyIds,
      allPropertyIds,
      selectedCalendarTypes,
    });
    return applyCalendarDisplayFilters(scoped, {
      searchQuery,
      propertyMap,
      selectedWorkbenchFilters: selectedFilters,
      userId,
    });
  }, [
    tasks,
    selectedPropertyIds,
    allPropertyIds,
    selectedCalendarTypes,
    searchQuery,
    propertyMap,
    selectedFilters,
    userId,
  ]);

  const headerAccentColor = useMemo(() => {
    const ids = properties.map((p) => p.id);
    if (
      properties.length <= 1 ||
      isAllPropertiesActive(selectedPropertyIds, ids) ||
      selectedPropertyIds.size !== 1
    ) {
      return PRIMARY_COLOR;
    }
    const onlyId = Array.from(selectedPropertyIds)[0];
    const p = properties.find((x) => x.id === onlyId) as
      | { icon_color_hex?: string | null }
      | undefined;
    return p?.icon_color_hex?.trim() || PRIMARY_COLOR;
  }, [properties, selectedPropertyIds]);

  const headerStyle = createGradientHeaderStyle(headerAccentColor);
  useThemeColor(headerAccentColor);

  const handleAskFilla = useCallback(
    (query: string) => {
      openAssistant();
      if (query) onSendMessage(query);
    },
    [openAssistant, onSendMessage]
  );

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCurrentMonth(startOfMonth(date));
    }
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(startOfMonth(today));
  }, []);

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
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

  const thirdColumn =
    isLargeScreen && selectedTaskId ? (
      <div className="flex h-full min-h-0 flex-col pt-4 pr-2 pl-2">
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          variant="column"
        />
      </div>
    ) : undefined;

  return (
    <>
      <DualPaneLayout
        header={
          <WorkbenchGradientHeader
            headerStyle={headerStyle}
            properties={properties}
            tasks={displayTasks}
            selectedPropertyIds={selectedPropertyIds}
            onPropertySelectionChange={setSelectedPropertyIds}
            onAskFilla={handleAskFilla}
          />
        }
        leftColumn={
          <CalendarLeftColumn
            properties={properties}
            propertiesLoading={propertiesLoading}
            displayTasks={displayTasks}
            tasksLoading={tasksLoading}
            selectedPropertyIds={selectedPropertyIds}
            onPropertySelectionChange={setSelectedPropertyIds}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            calendarMonth={currentMonth}
            onCalendarMonthChange={setCurrentMonth}
            selectedCalendarTypes={selectedCalendarTypes}
            onCalendarTypesChange={setSelectedCalendarTypes}
          />
        }
        rightColumn={
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            <CalendarToolbar
              className="shrink-0"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onToday={handleToday}
            />
            {viewMode === "month" ? (
              <div className="flex min-h-0 max-h-[777px] flex-1 flex-col overflow-hidden">
                <CalendarMonthGrid
                  month={currentMonth}
                  tasks={displayTasks}
                  selectedDate={selectedDate}
                  onDateSelect={(d) => handleDateSelect(d)}
                  onTaskClick={handleTaskClick}
                  onTaskReschedule={handleTaskReschedule}
                  selectedTaskId={selectedTaskId}
                  propertyMap={propertyMap}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/50 p-8 text-sm text-muted-foreground">
                {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view coming soon — use Month
                for the full grid.
              </div>
            )}
          </div>
        }
        thirdColumn={thirdColumn}
      />

      {selectedTaskId && !isLargeScreen && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          variant="modal"
        />
      )}
    </>
  );
}

/**
 * Calendar — three-column layout with gradient header (Today, weather, search, filters).
 */
export default function CalendarPage() {
  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
      <div className="calendar-page min-h-screen w-full max-w-full overflow-x-hidden bg-background">
        <CalendarPageContent />
      </div>
    </WorkbenchControlsProvider>
  );
}
