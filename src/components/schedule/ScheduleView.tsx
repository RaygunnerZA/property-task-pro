import { useMemo } from "react";
import { format, startOfDay } from "date-fns";
import TaskCard from "@/components/TaskCard";
interface ScheduleViewProps {
  tasks: any[];
  properties?: any[];
  selectedDate?: Date | undefined;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
}

/**
 * Schedule View Component
 * 
 * Displays tasks in a vertical timeline format:
 * - Shows dates as headers
 * - Only shows hours that have tasks (no empty hour slots)
 * - Time-scheduled tasks first, "Any Time" tasks at bottom
 */
export function ScheduleView({
  tasks,
  properties = [],
  onTaskClick,
  selectedTaskId,
}: ScheduleViewProps) {
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Parse and categorize tasks into dated vs unscheduled
  const { datedTasks, anyTimeTasks } = useMemo(() => {
    const withDate: Array<{ task: any; time: Date; hasSpecificTime: boolean }> = [];
    const withoutTime: any[] = [];

    tasks.forEach((task) => {
      const dueValue = task.due_date || task.due_at;
      if (!dueValue) {
        withoutTime.push(task);
        return;
      }

      try {
        const dueDate = new Date(dueValue);
        // Check if task has a specific time (not just date)
        const startOfTaskDay = startOfDay(dueDate);
        const hasTime = dueDate.getTime() !== startOfTaskDay.getTime();

        withDate.push({
          task,
          time: dueDate,
          hasSpecificTime: hasTime,
        });
      } catch {
        withoutTime.push(task);
      }
    });

    // Sort time tasks chronologically
    withDate.sort((a, b) => a.time.getTime() - b.time.getTime());

    return {
      datedTasks: withDate,
      anyTimeTasks: withoutTime,
    };
  }, [tasks]);

  // Group dated tasks by day
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Array<{ task: any; time: Date; hasSpecificTime: boolean }>>();
    
    datedTasks.forEach(({ task, time, hasSpecificTime }) => {
      const dateKey = format(time, "yyyy-MM-dd");
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push({ task, time, hasSpecificTime });
    });
    
    // Sort tasks within each date by time
    grouped.forEach((tasks) => {
      tasks.sort((a, b) => a.time.getTime() - b.time.getTime());
    });
    
    return grouped;
  }, [datedTasks]);

  // Get dates sorted chronologically
  const dates = useMemo(() => {
    return Array.from(tasksByDate.keys()).sort();
  }, [tasksByDate]);

  return (
    <div className="flex h-full w-full relative">
      {/* Task Stack */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {/* Dated tasks grouped by date */}
          {dates.map((dateKey) => {
            const dateTasks = tasksByDate.get(dateKey) || [];
            if (dateTasks.length === 0) return null;

            const date = new Date(dateKey);
            const isTodayDate = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const dateLabel = isTodayDate 
              ? "Today" 
              : format(date, "EEEE, MMMM d");

            return (
              <div key={dateKey} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 border-b border-border/50">
                  <h3 className="text-sm font-semibold text-foreground tracking-wide">
                    {dateLabel}
                  </h3>
                </div>

                {/* Tasks for this date */}
                <div className="space-y-3">
                {dateTasks.map(({ task, time, hasSpecificTime }) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;
                  const timeLabel = hasSpecificTime ? format(time, "HH:mm") : "Any";

                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0 pt-3">
                        {timeLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <TaskCard
                          task={task}
                          property={property}
                          isSelected={selectedTaskId === task.id}
                          layout="horizontal"
                          onClick={() => onTaskClick?.(task.id)}
                        />
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}

          {/* Any Time tasks section */}
          {anyTimeTasks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Any Time
              </h3>
              <div className="space-y-3">
                {anyTimeTasks.map((task) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;

                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0 pt-3">
                        Any
                      </span>
                      <div className="flex-1 min-w-0">
                        <TaskCard
                          task={task}
                          property={property}
                          isSelected={selectedTaskId === task.id}
                          layout="horizontal"
                          onClick={() => onTaskClick?.(task.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {datedTasks.length === 0 && anyTimeTasks.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No tasks scheduled for this date</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
