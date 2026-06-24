import { useMemo } from "react";
import { format } from "date-fns";
import TaskCard from "@/components/TaskCard";
import {
  CALENDAR_AFTERNOON_TIME,
  CALENDAR_MORNING_TIME,
  hasAssigneeDefinedScheduleTime,
} from "@/lib/calendarTaskSchedule";
import { cn } from "@/lib/utils";

const SCHEDULE_TIME_COLUMN_CLASS = "w-20 sm:w-[5.5rem] flex-shrink-0";

const SCHEDULE_DAY_DIVIDER_CLASS = "pt-[14px] border-t-2 border-white/50";

const SCHEDULE_DATE_LABEL_CLASS =
  "text-[13px] font-semibold text-[#85BABC] pb-[11px]";

const SCHEDULE_TIME_BADGE_CLASS =
  "text-xs font-mono font-medium uppercase tracking-wide text-muted-foreground w-[50px] h-6 -ml-1 px-[9px] py-[5px] rounded-[12px] bg-black/5 shadow-[1px_1px_1px_0px_rgba(255,255,255,0.47),inset_1px_2px_2px_0px_rgba(0,0,0,0.11)]";

function formatScheduleTimeLabel(time: Date, hasSpecificTime: boolean): string | null {
  if (!hasSpecificTime) return null;
  const hhmm = format(time, "HH:mm");
  if (hhmm === CALENDAR_MORNING_TIME) return "MORNING";
  if (hhmm === CALENDAR_AFTERNOON_TIME) return "AFTERNOON";
  return hhmm;
}
interface ScheduleViewProps {
  tasks: any[];
  properties?: any[];
  selectedDate?: Date | undefined;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
  showDateHeaders?: boolean;
}

/**
 * Schedule View Component
 * 
 * Displays tasks in a vertical timeline format:
 * - Day, date, and time labels live in the left column beside each task card
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
        const hasSpecificTime = hasAssigneeDefinedScheduleTime(task, dueValue);

        withDate.push({
          task,
          time: dueDate,
          hasSpecificTime,
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
      <div className="flex-1 overflow-y-auto px-4 pt-0.5 pb-4">
        <div className="space-y-6">
          {/* Dated tasks grouped by date */}
          {dates.map((dateKey, dayIndex) => {
            const dateTasks = tasksByDate.get(dateKey) || [];
            if (dateTasks.length === 0) return null;

            const date = new Date(dateKey);
            const isTodayDate = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const weekdayLabel = isTodayDate ? "Today" : format(date, "EEEE");
            const dateLabel = format(date, "MMMM d");

            return (
              <div
                key={dateKey}
                className={cn(
                  "space-y-3",
                  dayIndex > 0 && SCHEDULE_DAY_DIVIDER_CLASS
                )}
              >
                {dateTasks.map(({ task, time, hasSpecificTime }, taskIndex) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;
                  const timeLabel = formatScheduleTimeLabel(time, hasSpecificTime);
                  const isFirstOfDay = taskIndex === 0;

                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3"
                    >
                      <div
                        className={cn(
                          SCHEDULE_TIME_COLUMN_CLASS,
                          "pt-3 flex flex-col gap-0.5 leading-tight"
                        )}
                      >
                        {isFirstOfDay ? (
                          <>
                            <span className="text-base font-semibold text-foreground tracking-wide">
                              {weekdayLabel}
                            </span>
                            <span className={SCHEDULE_DATE_LABEL_CLASS}>
                              {dateLabel}
                            </span>
                          </>
                        ) : null}
                        {timeLabel ? (
                          <span
                            className={cn(
                              SCHEDULE_TIME_BADGE_CLASS,
                              isFirstOfDay && "mt-0.5"
                            )}
                          >
                            {timeLabel}
                          </span>
                        ) : null}
                      </div>
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
                      <div className={SCHEDULE_TIME_COLUMN_CLASS} />
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
