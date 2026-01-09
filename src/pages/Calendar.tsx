import { useState, useMemo } from "react";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import TaskCard from "@/components/TaskCard";
import { format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Card } from "@/components/ui/card";

const Calendar = () => {
  const { data: tasksData = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loading = tasksLoading || propertiesLoading;

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
    }));
  }, [tasksData]);

  // Create property map for quick lookup (use property_name from tasks_view or fallback to properties)
  const propertyMap = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p]));
    // Also add property data from tasks_view
    tasksData.forEach((task: any) => {
      if (task.property_id && task.property_name && !map.has(task.property_id)) {
        map.set(task.property_id, {
          id: task.property_id,
          nickname: task.property_name,
          address: task.property_address || '',
        } as any);
      }
    });
    return map;
  }, [properties, tasksData]);

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

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
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
            <div className="rounded-xl bg-card p-4 shadow-e1">
              <DashboardCalendar
                tasks={tasks}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
            </div>
          </div>

          {/* Day Agenda - Right Side */}
          <div className="w-full">
            <Card className="shadow-e1 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Day Agenda
                </h2>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </p>
              </div>

              {tasksForSelectedDate.length === 0 ? (
                <div className="py-12">
                  <p className="text-muted-foreground">
                    No tasks scheduled for this date
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tasksForSelectedDate.map((task) => {
                    const property = task.property_id
                      ? propertyMap.get(task.property_id)
                      : undefined;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        property={property}
                        layout="vertical"
                        onClick={() => handleTaskClick(task.id)}
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
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

export default Calendar;

