import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContextHeader } from "@/components/ContextHeader";
import { BottomNav } from "@/components/BottomNav";
import { SegmentedControl } from "@/components/filla/SegmentedControl";
import { useScheduleData } from "@/hooks/useScheduleData";
import { getScheduleRange, ScheduleViewMode } from "@/utils/scheduleRange";
import { MiniCalendar, type CalendarEvent } from "@/components/filla/MiniCalendar";
import { WeekStripCalendar } from "@/components/schedule/WeekStripCalendar";
import { DayScheduleDrawer } from "@/components/schedule/DayScheduleDrawer";
import { ScheduleItemBase } from "@/types/schedule";
import { Search, SlidersHorizontal } from "lucide-react";

/**
 * SCHEDULE SCREEN
 * - Month, Week, List view modes
 * - Unified header with property selector and filters
 * - New Filla MiniCalendar with task/compliance markers
 */

const Schedule = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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

  /* --------------------------------------------
     ITEMS FOR SELECTED DATE
  --------------------------------------------- */
  const selectedISO = selectedDate.toISOString().slice(0, 10);

  const itemsForSelectedDate: ScheduleItemBase[] = useMemo(() => {
    return items.filter((i) => i.date === selectedISO);
  }, [items, selectedISO]);

  /* --------------------------------------------
     CONVERT ITEMS TO CALENDAR EVENTS
  --------------------------------------------- */
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    // Group items by date
    const byDate = new Map<string, ScheduleItemBase[]>();
    for (const item of items) {
      const existing = byDate.get(item.date) || [];
      existing.push(item);
      byDate.set(item.date, existing);
    }

    // Convert to CalendarEvent format
    return Array.from(byDate.entries()).map(([date, dayItems]) => ({
      date,
      tasks: dayItems
        .filter((item) => item.kind === "task")
        .map((item) => ({
          priority: (item.priority || "normal") as "low" | "normal" | "high",
        })),
      compliance: dayItems
        .filter((item) => item.kind === "signal")
        .map(() => ({
          severity: "medium" as "low" | "medium" | "high",
        })),
    }));
  }, [items]);

  const daysWithItems = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.date)));
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
      navigate(`/task/${item.id}`);
    }
    // Handle signal navigation later if needed
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
    <div className="min-h-screen bg-background pb-20">
      {/* HEADER */}
      <ContextHeader
        title="Schedule"
        action={
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>
        }
      />

      {/* VIEW MODE SEGMENT CONTROL */}
      <div className="px-4 pt-4 pb-2 flex justify-center">
        <SegmentedControl
          options={segmentOptions}
          selectedId={viewMode}
          onChange={(id) => setViewMode(id as ScheduleViewMode)}
        />
      </div>

      {/* SCROLL CONTAINER */}
      <div className="max-w-md mx-auto px-4 pb-4">
        {/* LOADING STATE */}
        {loading && (
          <div className="py-12 text-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="py-12 text-center">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        {/* CONTENT */}
        {!loading && !error && (
          <>
            {/* MONTH VIEW - New MiniCalendar */}
            {viewMode === "month" && (
              <>
                <MiniCalendar
                  selectedDate={selectedDate}
                  events={calendarEvents}
                  onSelect={handleSelectDate}
                  showMonthNav={true}
                />
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
      </div>

      <BottomNav />
    </div>
  );
};

export default Schedule;
