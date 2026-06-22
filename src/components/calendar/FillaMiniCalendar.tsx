import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  addDays,
  addWeeks,
  format,
  format as formatDate,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import {
  buildTasksByDate,
  dayCellBackground,
  dayDotColor,
  type DayUrgency,
  type TaskDateData,
} from "@/lib/calendarDayMeta";
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";

function resolveDayUrgency(data: TaskDateData | undefined): DayUrgency {
  if (!data || data.total === 0) return "none";
  if (data.maxUrgency && data.maxUrgency !== "none") return data.maxUrgency;
  if (data.overdue > 0) return "overdue";
  if (data.urgent > 0) return "urgent";
  if (data.high > 0) return "high";
  return "normal";
}

/** Neomorphic depth for mini-calendar day cells with task fill */
const MINI_CALENDAR_DAY_SHADOW =
  "1px 2px 1px 0px rgba(255, 255, 255, 0.8), inset 1.5px 2px 2.4px 0px rgba(0, 0, 0, 0.2), -1px -1px 1px 0px rgba(0, 0, 0, 0.1)";

const CALENDAR_WEEK_ROWS = 6;
const WEEK_STARTS_ON = 1 as const;
const WEEK_SLIDE_MS = 200;

/** Row height = cell height + row top margin (mt-0.5) */
function miniCalendarRowMetrics(variant: "sidebar" | "embedded") {
  const cellHeight = variant === "embedded" ? 30 : 28;
  const rowHeight = cellHeight + 2;
  return {
    rowHeight,
    expandedHeight: rowHeight * CALENDAR_WEEK_ROWS,
  };
}

function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

type MiniCalendarWeekStripHandle = {
  goWeek: (delta: -1 | 1) => void;
};

function WeekStripRow({
  weekStart,
  tasksByDate,
  selectedDate,
  onDateSelect,
  isEmbedded,
}: {
  weekStart: Date;
  tasksByDate: Map<string, TaskDateData>;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  isEmbedded: boolean;
}) {
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const daySizeClass = isEmbedded ? "h-7 w-7" : "h-[30px] w-[30px]";
  const dayTextClass = isEmbedded ? "text-[11px]" : "text-[13px]";

  return (
    <div className="w-full shrink-0">
      <div className="mb-1.5 flex w-full justify-between px-0.5">
        {weekDays.map((date) => {
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <div
              key={format(date, "yyyy-MM-dd-dow")}
              className={cn(
                "min-w-0 flex-1 text-center font-mono font-medium uppercase",
                isEmbedded ? "text-[0.65rem]" : "text-[10px]",
                isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              {formatDate(date, "EEE").toUpperCase()}
            </div>
          );
        })}
      </div>
      <div className="flex w-full justify-between px-0.5">
        {weekDays.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dateData = tasksByDate.get(dateKey);
          const maxUrgency = resolveDayUrgency(dateData);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const fill = dayCellBackground(maxUrgency, isSelected);
          const dot = dayDotColor(maxUrgency);

          return (
            <div key={dateKey} className="flex min-w-0 flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => onDateSelect?.(date)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-[8px] font-mono font-medium transition-colors",
                  daySizeClass,
                  isWeekend && !isSelected && "text-muted-foreground/50"
                )}
                style={{
                  backgroundColor: fill,
                  ...(fill ? { boxShadow: MINI_CALENDAR_DAY_SHADOW } : undefined),
                }}
              >
                <span className={cn(dayTextClass, isTodayDate && !isSelected && "font-semibold")}>
                  {date.getDate()}
                </span>
                {dot ? (
                  <span
                    className="absolute left-[3px] top-[3px] h-1 w-1 rounded-full"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MiniCalendarWeekStrip = forwardRef<
  MiniCalendarWeekStripHandle,
  {
    weekStart: Date;
    tasksByDate: Map<string, TaskDateData>;
    selectedDate?: Date;
    onDateSelect?: (date: Date | undefined) => void;
    onWeekChange: (nextWeekStart: Date) => void;
    isEmbedded: boolean;
  }
>(function MiniCalendarWeekStrip(
  { weekStart, tasksByDate, selectedDate, onDateSelect, onWeekChange, isEmbedded },
  ref
) {
  const [displayWeekStart, setDisplayWeekStart] = useState(weekStart);
  const [incomingWeekStart, setIncomingWeekStart] = useState<Date | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  const [translatePercent, setTranslatePercent] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isAnimating = incomingWeekStart != null;

  useEffect(() => {
    if (!isAnimating) setDisplayWeekStart(weekStart);
  }, [weekStart, isAnimating]);

  const goWeek = useCallback(
    (delta: -1 | 1) => {
      if (isAnimating) return;
      const nextWeekStart = addWeeks(displayWeekStart, delta);
      const direction = delta === 1 ? "next" : "prev";
      setIncomingWeekStart(nextWeekStart);
      setSlideDirection(direction);
      setTranslatePercent(direction === "next" ? 0 : -50);
      requestAnimationFrame(() => {
        setTranslatePercent(direction === "next" ? -50 : 0);
      });
      window.setTimeout(() => {
        setDisplayWeekStart(nextWeekStart);
        setIncomingWeekStart(null);
        setSlideDirection(null);
        setTranslatePercent(0);
        onWeekChange(nextWeekStart);
      }, WEEK_SLIDE_MS);
    },
    [displayWeekStart, isAnimating, onWeekChange]
  );

  useImperativeHandle(ref, () => ({ goWeek }), [goWeek]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = start.x - touch.clientX;
    const dy = start.y - touch.clientY;
    if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy) * 1.1) return;
    goWeek(dx > 0 ? 1 : -1);
  };

  const leftWeekStart =
    slideDirection === "prev" && incomingWeekStart ? incomingWeekStart : displayWeekStart;
  const rightWeekStart =
    slideDirection === "next" && incomingWeekStart ? incomingWeekStart : displayWeekStart;

  return (
    <div
      className="w-full min-w-0 touch-pan-x overscroll-x-contain"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="w-full overflow-hidden">
        <div
          className={cn(
            "flex transition-transform duration-200 ease-out",
            incomingWeekStart ? "w-[200%]" : "w-full"
          )}
          style={{
            transform: incomingWeekStart ? `translateX(${translatePercent}%)` : undefined,
          }}
        >
          <div className={incomingWeekStart ? "w-1/2 shrink-0" : "w-full shrink-0"}>
            <WeekStripRow
              weekStart={leftWeekStart}
              tasksByDate={tasksByDate}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              isEmbedded={isEmbedded}
            />
          </div>
          {incomingWeekStart ? (
            <div className="w-1/2 shrink-0">
              <WeekStripRow
                weekStart={rightWeekStart}
                tasksByDate={tasksByDate}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
                isEmbedded={isEmbedded}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export type { TaskDateData };

export interface FillaMiniCalendarProps {
  tasks?: any[];
  tasksByDate?: Map<string, TaskDateData>;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  className?: string;
  /** Slightly tighter padding for intake modals */
  variant?: "sidebar" | "embedded";
  /** Initial expand state for collapsible sidebar calendar (default expanded). */
  defaultExpanded?: boolean;
  /** When true, selecting a date collapses to the week strip (schedule mobile). */
  collapseOnDateSelect?: boolean;
}

/**
 * Unified mini calendar — sidebar, calendar page, and intake modals.
 * Day fill reflects greatest task urgency on that date; dot reinforces urgency.
 */
export function FillaMiniCalendar({
  tasks = [],
  selectedDate,
  onDateSelect,
  month,
  onMonthChange,
  className,
  tasksByDate: providedTasksByDate,
  variant = "sidebar",
  defaultExpanded = true,
  collapseOnDateSelect = false,
}: FillaMiniCalendarProps) {
  const tasksByDate = useMemo(() => {
    if (providedTasksByDate) return providedTasksByDate;
    return buildTasksByDate(tasks);
  }, [providedTasksByDate, tasks]);

  const datesWithTasks = useMemo(() => {
    return Array.from(tasksByDate.keys())
      .map((key) => {
        try {
          const [y, m, d] = key.split("-").map(Number);
          return new Date(y, m - 1, d);
        } catch {
          return null;
        }
      })
      .filter((d): d is Date => d != null);
  }, [tasksByDate]);

  const isEmbedded = variant === "embedded";
  const isCollapsible = !isEmbedded;
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!defaultExpanded) return false;
    if (collapseOnDateSelect && selectedDate) return false;
    return true;
  });
  const [internalMonth, setInternalMonth] = useState(
    () => month ?? selectedDate ?? new Date()
  );
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(selectedDate ?? new Date(), { weekStartsOn: WEEK_STARTS_ON })
  );
  const { expandedHeight } = miniCalendarRowMetrics(variant);
  const gridMaxHeight = expandedHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const weekStripRef = useRef<MiniCalendarWeekStripHandle>(null);

  const displayMonth = month ?? internalMonth;

  useEffect(() => {
    if (month) setInternalMonth(month);
  }, [month]);

  useEffect(() => {
    if (!selectedDate) return;
    setWeekStart(startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON }));
  }, [selectedDate]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (collapseOnDateSelect && date && isExpanded) {
        setIsExpanded(false);
      }
      onDateSelect?.(date);
    },
    [collapseOnDateSelect, isExpanded, onDateSelect]
  );

  const handleMonthChange = useCallback(
    (newMonth: Date) => {
      if (month === undefined) setInternalMonth(newMonth);
      onMonthChange?.(newMonth);
    },
    [month, onMonthChange]
  );

  const handleWeekChange = useCallback(
    (nextWeekStart: Date) => {
      setWeekStart(nextWeekStart);
      handleMonthChange(startOfMonth(nextWeekStart));
    },
    [handleMonthChange]
  );

  const navigateWeek = useCallback((delta: -1 | 1) => {
    weekStripRef.current?.goWeek(delta);
  }, []);

  const handleToggleExpanded = () => {
    setIsExpanded((expanded) => !expanded);
  };

  const showWeekStrip = isCollapsible && !isExpanded;

  const renderDayButton = (props: {
    date: Date;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }) => {
    const { date, onClick, className: propClassName } = props;
    const dateKey = format(date, "yyyy-MM-dd");
    const dateData = tasksByDate.get(dateKey);
    const maxUrgency = resolveDayUrgency(dateData);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const isTodayDate = isToday(date);
    const fill = dayCellBackground(maxUrgency, isSelected);
    const dot = dayDotColor(maxUrgency);

    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e);
          handleDateSelect(date);
        }}
        className={cn(
          propClassName,
          "relative font-mono rounded-[8px]",
          isEmbedded ? "h-6 w-6" : "h-[26px] w-[26px]"
        )}
        style={{
          backgroundColor: fill,
          ...(fill ? { boxShadow: MINI_CALENDAR_DAY_SHADOW } : undefined),
        }}
      >
        <span
          className={cn(
            isEmbedded ? "text-[11px]" : "text-[13px]",
            "font-medium",
            isTodayDate && !isSelected && "font-semibold"
          )}
        >
          {date.getDate()}
        </span>
        {dot ? (
          <span
            className="absolute top-[3px] left-[3px] h-1 w-1 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        ) : null}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "filla-mini-calendar w-full",
        variant === "sidebar" &&
          "w-full max-w-full sm:max-w-[311px] rounded-xl border border-border/40 bg-card/60 p-3 shadow-e1",
        className
      )}
      data-collapsed={showWeekStrip ? "true" : "false"}
    >
      {isCollapsible ? (
        <>
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
              isExpanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={displayMonth}
                onMonthChange={handleMonthChange}
                className={cn(
                  isEmbedded ? "max-w-[247px]" : "w-full max-w-full sm:max-w-[311px]"
                )}
                classNames={{
                  months: "flex flex-col w-full",
                  month: "space-y-3 w-full",
                  caption: "flex justify-between items-center px-0.5 mb-1",
                  caption_label: cn(
                    "font-semibold text-foreground",
                    isEmbedded ? "text-base" : "text-sm"
                  ),
                  nav: "flex h-[26px] items-center gap-[17px] pt-[3px]",
                  nav_button: cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
                  ),
                  nav_button_previous: "",
                  nav_button_next: "",
                  table: "w-full border-collapse",
                  head: isEmbedded ? undefined : "h-6",
                  head_row: "flex w-full justify-between mb-0",
                  head_cell: cn(
                    "flex-1 text-center font-mono font-medium uppercase text-foreground",
                    "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
                    isEmbedded ? "text-[0.65rem]" : "text-[11px]"
                  ),
                  row: "flex w-full justify-between mt-0.5",
                  tbody: cn(
                    "block overflow-hidden transition-[max-height] duration-300 ease-in-out",
                    isEmbedded ? "max-h-[192px]" : undefined
                  ),
                  cell: cn(
                    "relative flex flex-1 items-center justify-center p-0 text-center",
                    "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
                    isEmbedded ? "h-[30px]" : "h-[28px]"
                  ),
                  day: cn(
                    "relative flex flex-col items-center justify-center rounded-[5px] font-medium transition-colors",
                    isEmbedded ? "h-6 w-6 text-xs" : "h-[26px] w-[26px] text-sm"
                  ),
                  day_selected: "",
                  day_today: "",
                  day_outside: "text-muted-foreground/40",
                  day_disabled: "text-muted-foreground/30",
                  day_hidden: "invisible",
                }}
                modifiers={{ hasTasks: datesWithTasks }}
                formatters={{
                  formatWeekdayName: (date) => formatDate(date, "EEE").toUpperCase(),
                }}
                components={{
                  IconLeft: () => (
                    <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />
                  ),
                  IconRight: () => (
                    <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />
                  ),
                  CaptionLabel: ({ displayMonth: captionMonth }) => (
                    <CalendarMonthYearLabel
                      date={captionMonth}
                      monthClassName={cn(
                        "font-semibold text-ink pl-[7px]",
                        isEmbedded ? "text-base" : "text-xl"
                      )}
                    />
                  ),
                  Day: renderDayButton,
                }}
                styles={{
                  tbody: { maxHeight: gridMaxHeight },
                }}
              />
            </div>
          </div>
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
              showWeekStrip
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <CalendarMonthYearLabel
                    date={displayMonth}
                    monthClassName={cn(
                      "font-semibold text-ink pl-[7px]",
                      isEmbedded ? "text-base" : "text-xl"
                    )}
                  />
                  <div className="flex h-[26px] items-center gap-[17px] pt-[3px]">
                    <button
                      type="button"
                      onClick={() => navigateWeek(-1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateWeek(1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
                <MiniCalendarWeekStrip
                  ref={weekStripRef}
                  weekStart={weekStart}
                  tasksByDate={tasksByDate}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onWeekChange={handleWeekChange}
                  isEmbedded={isEmbedded}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          month={displayMonth}
          onMonthChange={handleMonthChange}
          className={cn(isEmbedded ? "max-w-[247px]" : "w-full max-w-full sm:max-w-[311px]")}
          classNames={{
            months: "flex flex-col w-full",
            month: "space-y-3 w-full",
            caption: "flex justify-between items-center px-0.5 mb-1",
            caption_label: cn(
              "font-semibold text-foreground",
              isEmbedded ? "text-base" : "text-sm"
            ),
            nav: "flex h-[26px] items-center gap-[17px] pt-[3px]",
            nav_button: cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
            ),
            nav_button_previous: "",
            nav_button_next: "",
            table: "w-full border-collapse",
            head: isEmbedded ? undefined : "h-6",
            head_row: "flex w-full justify-between mb-0",
            head_cell: cn(
              "flex-1 text-center font-mono font-medium uppercase text-foreground",
              "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
              isEmbedded ? "text-[0.65rem]" : "text-[11px]"
            ),
            row: "flex w-full justify-between mt-0.5",
            tbody: cn(
              "block overflow-hidden transition-[max-height] duration-300 ease-in-out",
              isEmbedded ? "max-h-[192px]" : undefined
            ),
            cell: cn(
              "relative flex flex-1 items-center justify-center p-0 text-center",
              "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
              isEmbedded ? "h-[30px]" : "h-[28px]"
            ),
            day: cn(
              "relative flex flex-col items-center justify-center rounded-[5px] font-medium transition-colors",
              isEmbedded ? "h-6 w-6 text-xs" : "h-[26px] w-[26px] text-sm"
            ),
            day_selected: "",
            day_today: "",
            day_outside: "text-muted-foreground/40",
            day_disabled: "text-muted-foreground/30",
            day_hidden: "invisible",
          }}
          modifiers={{ hasTasks: datesWithTasks }}
          formatters={{
            formatWeekdayName: (date) => formatDate(date, "EEE").toUpperCase(),
          }}
          components={{
            IconLeft: () => <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />,
            IconRight: () => <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />,
            CaptionLabel: ({ displayMonth: captionMonth }) => (
              <CalendarMonthYearLabel
                date={captionMonth}
                monthClassName={cn(
                  "font-semibold text-ink pl-[7px]",
                  isEmbedded ? "text-base" : "text-xl"
                )}
              />
            ),
            Day: renderDayButton,
          }}
        />
      )}
      {isCollapsible ? (
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse calendar" : "Expand calendar"}
          className="mt-1 flex w-full items-center justify-center rounded-lg py-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <ChevronUp
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-in-out",
              !isExpanded && "rotate-180"
            )}
            strokeWidth={2.2}
          />
        </button>
      ) : null}
      <style>{`
        .filla-mini-calendar .rdp-tbody {
          display: block;
        }
        .filla-mini-calendar .rdp-tbody .rdp-row {
          display: flex;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
