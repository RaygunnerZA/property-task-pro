import React, { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/filla/SegmentedControl";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useScheduleData } from "@/hooks/useScheduleData";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { getScheduleRange, ScheduleViewMode } from "@/utils/scheduleRange";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { WeekStripCalendar } from "@/components/schedule/WeekStripCalendar";
import { DayScheduleDrawer } from "@/components/schedule/DayScheduleDrawer";
import { ScheduleItemBase } from "@/types/schedule";
import { Search, SlidersHorizontal, Calendar } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { Button } from "@/components/ui/button";
import { useScheduleContext } from "@/contexts/ScheduleContext";

/**
 * SCHEDULE SCREEN
 * - Month, Week, List view modes
 * - Unified header with property selector and filters
 * - New Filla MiniCalendar with task/compliance markers
 */

const Schedule = () => {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const { selectedDate, setSelectedDate } = useScheduleContext();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  /* --------------------------------------------
     BUILD DATE RANGE BASED ON VIEW MODE
  --------------------------------------------- */
  const { start, end } = useMemo(
    () => getScheduleRange(viewMode, currentDate),
    [viewMode, currentDate]
  );

  /* --------------------------------------------
     FETCH DATA
  --------------------------------------------- */
  const filters = useMemo(() => ({}), []);
  
  const { items, loading, error } = useScheduleData({
    viewMode,
    rangeStart: start,
    rangeEnd: end,
    filters,
  });

  // Get tasks for calendar (DashboardCalendar needs tasks array)
  const { data: tasksData = [] } = useTasksQuery();
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
    }));
  }, [tasksData]);
  const tasksByDate = useMemo(() => {
    const map = new Map<
      string,
      { total: number; high: number; urgent: number; overdue: number }
    >();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizePriority = (priority: string | null | undefined): string => {
      if (!priority) return "normal";
      const normalized = priority.toLowerCase();
      if (normalized === "medium") return "normal";
      return normalized;
    };

    for (const task of tasksData as any[]) {
      const dueDateValue = task?.due_date || task?.due_at;
      if (!dueDateValue) continue;
      if (task.status === "completed" || task.status === "archived") continue;
      const d = new Date(dueDateValue);
      if (Number.isNaN(d.getTime())) continue;

      const dateKey = d.toISOString().slice(0, 10);
      const current = map.get(dateKey) ?? { total: 0, high: 0, urgent: 0, overdue: 0 };
      current.total += 1;

      const priority = normalizePriority(task.priority);
      if (priority === "high") current.high += 1;
      if (priority === "urgent") current.urgent += 1;

      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      if (day < today) current.overdue += 1;

      map.set(dateKey, current);
    }

    return map;
  }, [tasksData]);

  /* --------------------------------------------
     ITEMS FOR SELECTED DATE
  --------------------------------------------- */
  const selectedISO = selectedDate.toISOString().slice(0, 10);

  const itemsForSelectedDate: ScheduleItemBase[] = useMemo(() => {
    const filtered = items.filter((i) => i.date === selectedISO);
    return filtered;
  }, [items, selectedISO, selectedDate]);

  /* --------------------------------------------
     DAYS WITH ITEMS (for WeekStripCalendar)
  --------------------------------------------- */
  const daysWithItems = useMemo(() => {
    const uniqueDates = new Set<string>();
    items.forEach((item) => {
      if (item.date) {
        uniqueDates.add(item.date);
      }
    });
    return Array.from(uniqueDates);
  }, [items]);


  /* --------------------------------------------
     VIEW MODE OPTIONS
  --------------------------------------------- */

  const segmentOptions = [
    { id: "list", label: "List" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ];

  /* --------------------------------------------
     DATE NAVIGATION HANDLERS
  --------------------------------------------- */

  const handleChangeWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === "prev" ? -7 : 7));
    setCurrentDate(newDate);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
  };

  const handleItemPress = (item: ScheduleItemBase) => {
    if (item.kind === "task") {
      setSelectedTaskId(item.id);
    }
    // Handle signal navigation later if needed
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  /* --------------------------------------------
     GET START OF WEEK FOR WEEK VIEW
  --------------------------------------------- */
  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  /* --------------------------------------------
     DATE LABEL FOR DRAWER
  --------------------------------------------- */
  const dateLabel = useMemo(() => {
    if (viewMode === "list") {
      return "All upcoming";
    }
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [viewMode, selectedDate]);

  return (
    <StandardPage
      title="Schedule"
      icon={<Calendar className="h-6 w-6" />}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm">
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
        </div>
      }
      maxWidth="md"
    >
      {/* VIEW MODE SEGMENT CONTROL */}
      <div className="mb-4 flex justify-center">
        <SegmentedControl
          options={segmentOptions}
          selectedId={viewMode}
          onChange={(id) => setViewMode(id as ScheduleViewMode)}
        />
      </div>

      {/* CONTENT */}
      {loading ? (
        <LoadingState message="Loading schedule..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
          <>
            {/* MONTH VIEW - DashboardCalendar */}
            {viewMode === "month" && (
              <>
                <div className="rounded-xl bg-card p-4 shadow-e1">
                  <DashboardCalendar
                    tasks={tasks}
                    tasksByDate={tasksByDate}
                    selectedDate={selectedDate}
                    onDateSelect={handleSelectDate}
                  />
                </div>
                <div className="mt-4">
                  <DayScheduleDrawer
                    dateLabel={dateLabel}
                    items={itemsForSelectedDate}
                    onItemPress={handleItemPress}
                  />
                </div>
              </>
            )}

            {/* WEEK VIEW */}
            {viewMode === "week" && (
              <>
                <WeekStripCalendar
                  startOfWeek={startOfWeek}
                  selectedDate={selectedDate}
                  daysWithItems={daysWithItems}
                  onSelectDate={handleSelectDate}
                  onChangeWeek={handleChangeWeek}
                />
                <DayScheduleDrawer
                  dateLabel={dateLabel}
                  items={itemsForSelectedDate}
                  onItemPress={handleItemPress}
                />
              </>
            )}

            {/* LIST VIEW */}
            {viewMode === "list" && (
              <DayScheduleDrawer
                dateLabel={dateLabel}
                items={items}
                onItemPress={handleItemPress}
              />
            )}
          </>
        )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </StandardPage>
  );
};

export default Schedule;
