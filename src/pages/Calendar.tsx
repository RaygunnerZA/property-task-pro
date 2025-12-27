import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarGrid } from "@/components/schedule/CalendarGrid";
import { useTasks } from "@/hooks/use-tasks";
import { useProperties } from "@/hooks/useProperties";
import TaskCard from "@/components/TaskCard";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

const Calendar = () => {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const { properties } = useProperties();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Get tasks for the selected date
  const tasksForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    
    const selectedDayStart = startOfDay(selectedDate);
    
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      try {
        const taskDate = startOfDay(new Date(task.due_date));
        return isSameDay(taskDate, selectedDayStart);
      } catch {
        return false;
      }
    });
  }, [tasks, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header
        className={cn(
          "sticky top-0 z-40",
          "bg-card",
          "shadow-[inset_0_-1px_2px_rgba(0,0,0,0.05)]"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-[#8EC9CE]" />
            <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar Grid - Left Side */}
            <div className="w-full">
              <CalendarGrid
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
            </div>

            {/* Day Agenda - Right Side */}
            <div className="w-full">
              <div
                className={cn(
                  "rounded-xl bg-card",
                  "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
                  "p-6"
                )}
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Day Agenda
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>

                {tasksForSelectedDate.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      No tasks scheduled for this date
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasksForSelectedDate.map((task) => {
                      const property = task.property_id
                        ? propertyMap.get(task.property_id)
                        : undefined;
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          property={property}
                          onClick={() => navigate(`/task/${task.id}`)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Calendar;

