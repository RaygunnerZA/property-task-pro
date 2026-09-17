import { useMemo, useLayoutEffect, useRef } from "react";
import { format, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import MagneticScrollArea from "@/components/ui/MagneticScrollArea";
import {
  CALENDAR_AFTERNOON_TIME,
  CALENDAR_MORNING_TIME,
  hasExplicitTime,
  parseScheduleDateTime,
} from "@/lib/calendarTaskSchedule";
import { cn } from "@/lib/utils";

const SCHEDULE_TIME_COLUMN_CLASS = "w-[81px] sm:w-[5.5rem] flex-shrink-0";

const SCHEDULE_DAY_DIVIDER_CLASS =
  "pt-[15px] pb-[15px] transition-[padding] duration-200 ease-out motion-reduce:transition-none group-hover/day:pt-0 group-hover/day:pb-[10px] group-focus-within/day:pt-0 group-focus-within/day:pb-[10px] max-md:pt-0 max-md:pb-[10px]";

const SCHEDULE_DATE_LABEL_CLASS =
  "text-sm font-semibold text-primary pb-[11px]";

const SCHEDULE_TIME_BADGE_CLASS =
  "text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground w-[57px] h-6 -ml-1 pl-[9px] pr-[16px] py-[5px] rounded-xl bg-black/5 shadow-[1px_1px_1px_0px_rgba(255,255,255,0.47),inset_1px_2px_2px_0px_rgba(0,0,0,0.11)]";

function formatScheduleTimeLabel(time: Date, hasSpecificTime: boolean): string | null {
  if (!hasSpecificTime) return null;
  const hhmm = format(time, "HH:mm");
  if (hhmm === CALENDAR_MORNING_TIME) return null;
  if (hhmm === CALENDAR_AFTERNOON_TIME) return null;
  return hhmm;
}

function alignScheduleDayIntoView(target: HTMLElement, innerScroller: HTMLElement | null) {
  const innerCanScroll =
    innerScroller != null && innerScroller.scrollHeight > innerScroller.clientHeight + 1;
  if (innerCanScroll && innerScroller) {
    const top =
      target.getBoundingClientRect().top -
      innerScroller.getBoundingClientRect().top +
      innerScroller.scrollTop;
    innerScroller.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    return;
  }
  // Workbench uses page scroll (left · centre · right move together). The inner
  // list is not overflow-clipped, so we have to move `main` to the selected day.
  target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
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
    <div className="flex justify-center pt-[10px] pb-[10px]">
      <button
        type="button"
        onClick={() => onCreate(date)}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/80 transition-colors hover:bg-primary/20 hover:text-primary"
        aria-label={`Create task on ${dateLabel}`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
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
 * - Hover (or selected day) reveals a subtle + to create a task for that day
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
  const rootRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
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
        hasSpecificTime: hasExplicitTime(dueValue),
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

  useLayoutEffect(() => {
    const root = rootRef.current;

    const fitToViewport = () => {
      if (!root) return;
      const top = root.getBoundingClientRect().top;
      const available = Math.max(320, window.innerHeight - top - 16);
      root.style.maxHeight = `${available}px`;
      const inner = scrollContainerRef.current;
      const spacer = spacerRef.current;
      if (inner && spacer) {
        spacer.style.height = `${Math.max(0, inner.clientHeight - 88)}px`;
      }
    };

    const dateKey = selectedDate
      ? format(startOfDay(selectedDate), "yyyy-MM-dd")
      : null;

    const align = () => {
      fitToViewport();
      if (!dateKey) return true;
      const target = document.getElementById(`schedule-day-${dateKey}`);
      if (!(target instanceof HTMLElement) || target.getBoundingClientRect().height < 8) {
        return false;
      }
      const inner = scrollContainerRef.current;
      if (!inner || inner.scrollHeight <= inner.clientHeight + 1) {
        return false;
      }
      alignScheduleDayIntoView(target, inner);
      const edge = inner.getBoundingClientRect().top;
      return Math.abs(target.getBoundingClientRect().top - edge) <= 48;
    };

    let cancelled = false;
    let attempts = 0;

    const tick = () => {
      if (cancelled) return;
      const done = align();
      attempts += 1;
      if (!done && attempts < 90) {
        requestAnimationFrame(tick);
      }
    };

    tick();

    const inner = scrollContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled) align();
    });
    if (root) resizeObserver.observe(root);
    if (inner) resizeObserver.observe(inner);

    const later = [80, 250, 600].map((ms) => window.setTimeout(align, ms));
    window.addEventListener("resize", fitToViewport);
    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      later.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", fitToViewport);
    };
  }, [selectedDate, dates]);

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 w-full overflow-hidden">
      {/* Task Stack — internal scroll with magnetic edge squish + top/bottom shadow hints */}
      <MagneticScrollArea
        ref={scrollContainerRef}
        className="min-w-0 flex-1"
        viewportClassName="px-2 pt-0.5 pb-4"
      >
        <div>
          {/* Dated tasks grouped by date */}
          {dates.map((dateKey, dayIndex) => {
            const dateTasks = tasksByDate.get(dateKey) || [];
            const date = parseScheduleDateTime(dateKey) ?? new Date(dateKey);
            const isTodayDate = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const weekdayLabel = isTodayDate ? "Today" : format(date, "EEEE");
            const dateLabel = format(date, "MMMM d");
            return (
              <div
                key={dateKey}
                id={`schedule-day-${dateKey}`}
                className="group/day scroll-mt-[calc(var(--header-height,70px)+12px)]"
              >
                <div className="space-y-3">
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
                </div>

                {onCreateForDate ? (
                  <div
                    className={cn(
                      "grid min-h-0 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                      "grid-rows-[0fr]",
                      "group-hover/day:grid-rows-[1fr] group-focus-within/day:grid-rows-[1fr]",
                      "max-md:grid-rows-[1fr]"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ScheduleCreateTaskRow date={date} onCreate={onCreateForDate} />
                    </div>
                  </div>
                ) : null}

                {dayIndex < dates.length - 1 ? (
                  <div
                    aria-hidden
                    data-schedule-day-rule
                    className={SCHEDULE_DAY_DIVIDER_CLASS}
                  >
                    <div className="perforation-list" />
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
        {/* Lets any selected day scroll to the top of the pane. */}
        <div
          ref={spacerRef}
          aria-hidden
          className="pointer-events-none w-full shrink-0"
        />
      </MagneticScrollArea>
    </div>
  );
}
