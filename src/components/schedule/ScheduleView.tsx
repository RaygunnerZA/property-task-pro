import { useMemo, useEffect, useRef } from "react";
import { format, isSameDay, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import MagneticScrollArea from "@/components/ui/MagneticScrollArea";
import {
  CALENDAR_AFTERNOON_TIME,
  CALENDAR_MORNING_TIME,
  hasAssigneeDefinedScheduleTime,
  parseScheduleDateTime,
} from "@/lib/calendarTaskSchedule";
import { intakeReportIssueMicroClassName } from "@/lib/intake-action-buttons";
import { cn } from "@/lib/utils";

const SCHEDULE_TIME_COLUMN_CLASS = "w-[81px] sm:w-[5.5rem] flex-shrink-0";

const SCHEDULE_DAY_DIVIDER_CLASS = "pt-[14px] border-t-2 border-white/50";

const SCHEDULE_DATE_LABEL_CLASS =
  "text-sm font-semibold text-primary pb-[11px]";

const SCHEDULE_TIME_BADGE_CLASS =
  "text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground w-[50px] h-6 -ml-1 px-[9px] py-[5px] rounded-xl bg-black/5 shadow-[1px_1px_1px_0px_rgba(255,255,255,0.47),inset_1px_2px_2px_0px_rgba(0,0,0,0.11)]";

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
  onCreateForDate?: (date: Date) => void;
}

function ScheduleCreateTaskRow({
  date,
  onCreate,
}: {
  date: Date;
  onCreate: (date: Date) => void;
}) {
  const dateLabel = format(date, "MMMM d");
  return (
    <div className="flex items-start gap-3 pt-1">
      <div className={SCHEDULE_TIME_COLUMN_CLASS} />
      <button
        type="button"
        onClick={() => onCreate(date)}
        className={cn(intakeReportIssueMicroClassName, "h-8 px-3")}
        aria-label={`Create task on ${dateLabel}`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
        Create Task
      </button>
    </div>
  );
}

/**
 * Schedule View Component
 *
 * Displays tasks in a vertical timeline format:
 * - Day, date, and time labels live in the left column beside each task card
 * - Only shows hours that have tasks (no empty hour slots)
 * - Time-scheduled tasks first, "Any Time" tasks at bottom
 * - Hover (or selected day) expands a Create Task action after that day's tasks
 */
export function ScheduleView({
  tasks,
  properties = [],
  selectedDate,
  onTaskClick,
  selectedTaskId,
  onCreateForDate,
}: ScheduleViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

      const dueDate = parseScheduleDateTime(dueValue);
      if (!dueDate) {
        withoutTime.push(task);
        return;
      }

      withDate.push({
        task,
        time: dueDate,
        hasSpecificTime: hasAssigneeDefinedScheduleTime(task, dueValue),
      });
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
    grouped.forEach((dayTasks) => {
      dayTasks.sort((a, b) => a.time.getTime() - b.time.getTime());
    });

    return grouped;
  }, [datedTasks]);

  // Dates with tasks, plus the selected day so empty days still appear
  const dates = useMemo(() => {
    const keys = new Set(tasksByDate.keys());
    if (selectedDate) {
      keys.add(format(startOfDay(selectedDate), "yyyy-MM-dd"));
    }
    return Array.from(keys).sort();
  }, [tasksByDate, selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const dateKey = format(startOfDay(selectedDate), "yyyy-MM-dd");
    const target = container.querySelector(`#schedule-day-${dateKey}`);
    if (!(target instanceof HTMLElement)) return;

    // Scroll only this list — `scrollIntoView` also moves ancestor page/shell scrollers
    // (e.g. switching Calendar → Schedule on the workbench jumps the desktop layout).
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }, [selectedDate, dates]);

  return (
    <div className="flex h-full w-full relative">
      {/* Task Stack — internal scroll with magnetic edge squish + top/bottom shadow hints */}
      <MagneticScrollArea
        ref={scrollContainerRef}
        className="min-w-0 flex-1"
        viewportClassName="px-2 pt-0.5 pb-4"
      >
        <div className="space-y-6">
          {/* Dated tasks grouped by date */}
          {dates.map((dateKey, dayIndex) => {
            const dateTasks = tasksByDate.get(dateKey) || [];
            const date = parseScheduleDateTime(dateKey) ?? new Date(dateKey);
            const isTodayDate = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const weekdayLabel = isTodayDate ? "Today" : format(date, "EEEE");
            const dateLabel = format(date, "MMMM d");
            const isSelectedDay = selectedDate ? isSameDay(date, selectedDate) : false;

            return (
              <div
                key={dateKey}
                id={`schedule-day-${dateKey}`}
                className={cn(
                  "group/day list-stagger space-y-3",
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
                    <div key={task.id} className="flex items-start gap-3">
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
                            <span className={SCHEDULE_DATE_LABEL_CLASS}>{dateLabel}</span>
                          </>
                        ) : null}
                        {timeLabel ? (
                          <span
                            className={cn(SCHEDULE_TIME_BADGE_CLASS, isFirstOfDay && "mt-0.5")}
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

                {dateTasks.length === 0 ? (
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        SCHEDULE_TIME_COLUMN_CLASS,
                        "pt-3 flex flex-col gap-0.5 leading-tight"
                      )}
                    >
                      <span className="text-base font-semibold text-foreground tracking-wide">
                        {weekdayLabel}
                      </span>
                      <span className={SCHEDULE_DATE_LABEL_CLASS}>{dateLabel}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-3 text-sm text-muted-foreground">
                      No tasks
                    </div>
                  </div>
                ) : null}

                {onCreateForDate ? (
                  <div
                    data-open={isSelectedDay || dateTasks.length === 0 ? "true" : undefined}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      "grid-rows-[0fr]",
                      "group-hover/day:grid-rows-[1fr] group-focus-within/day:grid-rows-[1fr]",
                      "data-[open=true]:grid-rows-[1fr]",
                      "max-md:grid-rows-[1fr]"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ScheduleCreateTaskRow date={date} onCreate={onCreateForDate} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Any Time tasks section */}
          {anyTimeTasks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Any Time
              </h3>
              <div className="list-stagger space-y-3">
                {anyTimeTasks.map((task) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;

                  return (
                    <div key={task.id} className="flex items-start gap-3">
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
          {dates.length === 0 && anyTimeTasks.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No scheduled tasks</p>
            </div>
          )}
        </div>
      </MagneticScrollArea>
    </div>
  );
}
