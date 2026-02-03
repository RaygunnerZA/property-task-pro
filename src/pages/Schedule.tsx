import React, { useMemo, useState, useEffect } from "react";
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
import { debugLog } from "@/lib/logger";

/**
 * SCHEDULE SCREEN
 * - Month, Week, List view modes
 * - Unified header with property selector and filters
 * - New Filla MiniCalendar with task/compliance markers
 */

const Schedule = () => {
  // #region agent log
  console.log('[DEBUG] Schedule component rendering');
  debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'Schedule.tsx:24',message:'Schedule component render start',data:{timestamp:Date.now()},timestamp:Date.now()});
  // #endregion
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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
  // #region agent log
  useEffect(() => {
    console.log('[DEBUG] Schedule component state', {viewMode,start,end,itemsCount:items.length,loading,error,firstItem:items[0]||null,allItemDates:items.map(i=>i.date)});
    debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'Schedule.tsx:48',message:'Schedule component state',data:{viewMode,start,end,itemsCount:items.length,loading,error,firstItem:items[0]||null,allItemDates:items.map(i=>i.date)},timestamp:Date.now()});
  }, [items, loading, error, viewMode, start, end]);
  // #endregion

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

  /* --------------------------------------------
     ITEMS FOR SELECTED DATE
  --------------------------------------------- */
  const selectedISO = selectedDate.toISOString().slice(0, 10);

  const itemsForSelectedDate: ScheduleItemBase[] = useMemo(() => {
    const filtered = items.filter((i) => i.date === selectedISO);
    // #region agent log
    console.log('[DEBUG] Schedule filtering items for selected date', {selectedISO,selectedDate:selectedDate.toISOString(),totalItems:items.length,allItemDates:items.map(i=>i.date),filteredCount:filtered.length,filteredItems:filtered.map(i=>({id:i.id,kind:i.kind,date:i.date,title:i.title}))});
    debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'D',location:'Schedule.tsx:76',message:'Filtering items for selected date',data:{selectedISO,selectedDate:selectedDate.toISOString(),totalItems:items.length,allItemDates:items.map(i=>i.date),filteredCount:filtered.length,filteredItems:filtered.map(i=>({id:i.id,kind:i.kind,date:i.date,title:i.title}))},timestamp:Date.now()});
    // #endregion
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

  // #region agent log
  console.log('[DEBUG] Schedule component RETURN - about to render JSX', {itemsCount:items.length,loading,error,viewMode,selectedISO});
  debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'N',location:'Schedule.tsx:162',message:'Schedule component RETURN',data:{itemsCount:items.length,loading,error,viewMode,selectedISO,itemsForSelectedDateCount:itemsForSelectedDate.length},timestamp:Date.now()});
  // #endregion
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
      {(() => {
        // #region agent log
        if (!loading && !error) {
          console.log('[DEBUG] Schedule rendering content', {itemsCount:items.length,itemsForSelectedDateCount:itemsForSelectedDate.length,viewMode,selectedISO});
          debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'G',location:'Schedule.tsx:185',message:'Schedule rendering content',data:{itemsCount:items.length,itemsForSelectedDateCount:itemsForSelectedDate.length,viewMode,selectedISO,loading,error},timestamp:Date.now()});
        }
        // #endregion
        return null;
      })()}
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
