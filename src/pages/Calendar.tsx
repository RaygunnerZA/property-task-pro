import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarGrid } from "@/components/schedule/CalendarGrid";
import { useTasks } from "@/hooks/use-tasks";
import { useProperties } from "@/hooks/useProperties";
import TaskCard from "@/components/TaskCard";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Card } from "@/components/ui/card";

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
    <StandardPage
      title="Calendar"
      icon={<CalendarIcon className="h-6 w-6" />}
      maxWidth="md"
    >
      {loading ? (
        <LoadingState message="Loading calendar..." />
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
            <Card className="shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)] p-6">
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
            </Card>
          </div>
        </div>
      )}
    </StandardPage>
  );
};

export default Calendar;

