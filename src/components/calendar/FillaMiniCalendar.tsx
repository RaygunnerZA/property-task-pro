import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  format as formatDate,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
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

const COLLAPSED_VISIBLE_ROWS = 2;
const CALENDAR_WEEK_ROWS = 6;
const WEEK_STARTS_ON = 1 as const;

type PendingCollapsedScroll = "top" | "bottom" | "focus" | null;

/** Row height = cell height + row top margin (mt-0.5) */
function miniCalendarRowMetrics(variant: "sidebar" | "embedded") {
  const cellHeight = variant === "embedded" ? 30 : 28;
  const rowHeight = cellHeight + 2;
  return {
    rowHeight,
    collapsedHeight: rowHeight * COLLAPSED_VISIBLE_ROWS,
    expandedHeight: rowHeight * CALENDAR_WEEK_ROWS,
  };
}

function getMonthGridWeekCount(month: Date): number {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  let weeks = 0;
  let cursor = gridStart;

  while (cursor <= monthEnd || weeks < 4) {
    weeks += 1;
    cursor = addWeeks(cursor, 1);
    if (weeks >= CALENDAR_WEEK_ROWS) break;
  }

  return weeks;
}

function getWeekRowIndex(month: Date, date: Date): number {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
  const dateWeekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  const diffMs = dateWeekStart.getTime() - gridStart.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function getRowStartForFocus(month: Date, focusDate: Date): number {
  const weekCount = getMonthGridWeekCount(month);
  const rowIndex = getWeekRowIndex(month, focusDate);
  const maxStart = Math.max(0, weekCount - COLLAPSED_VISIBLE_ROWS);
  return Math.min(Math.max(0, rowIndex), maxStart);
}

function getFocusDateForMonth(month: Date, selectedDate?: Date): Date {
  if (selectedDate && isSameMonth(selectedDate, month)) return selectedDate;
  const today = new Date();
  if (isSameMonth(today, month)) return today;
  return startOfMonth(month);
}

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
  const [isExpanded, setIsExpanded] = useState(true);
  const [internalMonth, setInternalMonth] = useState(
    () => month ?? selectedDate ?? new Date()
  );
  const { rowHeight, collapsedHeight, expandedHeight } = miniCalendarRowMetrics(variant);
  const gridMaxHeight = isCollapsible && !isExpanded ? collapsedHeight : expandedHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const pendingScrollRef = useRef<PendingCollapsedScroll>(null);
  const isCollapsedNavRef = useRef(false);

  const displayMonth = month ?? internalMonth;

  useEffect(() => {
    if (month) setInternalMonth(month);
  }, [month]);

  const syncTbodyRef = useCallback(() => {
    tbodyRef.current =
      containerRef.current?.querySelector("tbody.rdp-tbody") ?? null;
  }, []);

  const handleMonthChange = useCallback(
    (newMonth: Date) => {
      if (month === undefined) setInternalMonth(newMonth);
      onMonthChange?.(newMonth);
    },
    [month, onMonthChange]
  );

  const applyCollapsedScroll = useCallback(
    (mode: PendingCollapsedScroll, focusMonth: Date = displayMonth) => {
      syncTbodyRef();
      const tbody = tbodyRef.current;
      if (!tbody || !mode) return;

      if (mode === "bottom") {
        tbody.scrollTop = Math.max(0, tbody.scrollHeight - collapsedHeight);
      } else if (mode === "top") {
        tbody.scrollTop = 0;
      } else if (mode === "focus") {
        const focusDate = getFocusDateForMonth(focusMonth, selectedDate);
        tbody.scrollTop = getRowStartForFocus(focusMonth, focusDate) * rowHeight;
      }
    },
    [collapsedHeight, displayMonth, rowHeight, selectedDate, syncTbodyRef]
  );

  const scrollCollapsedByWeek = useCallback(
    (direction: -1 | 1) => {
      syncTbodyRef();
      const tbody = tbodyRef.current;
      if (!tbody) return;

      const maxScroll = Math.max(0, tbody.scrollHeight - collapsedHeight);
      const nextScroll = tbody.scrollTop + direction * rowHeight;

      if (direction < 0 && tbody.scrollTop <= 0) {
        isCollapsedNavRef.current = true;
        pendingScrollRef.current = "bottom";
        handleMonthChange(subMonths(displayMonth, 1));
        return;
      }

      if (direction > 0 && tbody.scrollTop >= maxScroll - 1) {
        isCollapsedNavRef.current = true;
        pendingScrollRef.current = "top";
        handleMonthChange(addMonths(displayMonth, 1));
        return;
      }

      tbody.scrollTo({
        top: Math.min(maxScroll, Math.max(0, nextScroll)),
        behavior: "smooth",
      });
    },
    [collapsedHeight, displayMonth, handleMonthChange, rowHeight, syncTbodyRef]
  );

  useLayoutEffect(() => {
    syncTbodyRef();
    const tbody = tbodyRef.current;
    if (!tbody || isExpanded || !isCollapsible) return;

    const pending = pendingScrollRef.current;
    if (pending) {
      applyCollapsedScroll(pending, displayMonth);
      pendingScrollRef.current = null;
      isCollapsedNavRef.current = false;
      return;
    }

    if (!isCollapsedNavRef.current) {
      applyCollapsedScroll("focus", displayMonth);
    }
  }, [
    applyCollapsedScroll,
    displayMonth,
    isCollapsible,
    isExpanded,
    selectedDate,
    syncTbodyRef,
  ]);

  useLayoutEffect(() => {
    syncTbodyRef();
    const tbody = tbodyRef.current;
    if (!tbody) return;

    if (isExpanded) {
      tbody.scrollTop = 0;
    }
  }, [isExpanded, syncTbodyRef]);

  useEffect(() => {
    syncTbodyRef();
    const tbody = tbodyRef.current;
    if (!tbody || isExpanded || !isCollapsible) return;

    const onWheel = (event: WheelEvent) => {
      const maxScroll = Math.max(0, tbody.scrollHeight - collapsedHeight);
      const atTop = tbody.scrollTop <= 0;
      const atBottom = tbody.scrollTop >= maxScroll - 1;

      if (event.deltaY < 0 && atTop) {
        event.preventDefault();
        isCollapsedNavRef.current = true;
        pendingScrollRef.current = "bottom";
        handleMonthChange(subMonths(displayMonth, 1));
      } else if (event.deltaY > 0 && atBottom) {
        event.preventDefault();
        isCollapsedNavRef.current = true;
        pendingScrollRef.current = "top";
        handleMonthChange(addMonths(displayMonth, 1));
      }
    };

    tbody.addEventListener("wheel", onWheel, { passive: false });
    return () => tbody.removeEventListener("wheel", onWheel);
  }, [collapsedHeight, displayMonth, handleMonthChange, isCollapsible, isExpanded, syncTbodyRef]);

  const handleToggleExpanded = () => {
    if (isExpanded) {
      pendingScrollRef.current = "focus";
    }
    setIsExpanded((expanded) => !expanded);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "filla-mini-calendar w-full",
        variant === "sidebar" &&
          "max-w-[311px] rounded-xl border border-border/40 bg-card/60 p-3 shadow-e1",
        className
      )}
      data-collapsed={isCollapsible && !isExpanded ? "true" : "false"}
    >
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        month={displayMonth}
        onMonthChange={handleMonthChange}
        className={cn(isEmbedded ? "max-w-[247px]" : "max-w-[311px] w-full")}
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
            "block",
            isExpanded
              ? "overflow-hidden transition-[max-height] duration-300 ease-in-out"
              : "overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
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
          PreviousMonthButton: ({ onClick, ...props }) => (
            <button
              type="button"
              {...props}
              onClick={(event) => {
                if (isCollapsible && !isExpanded) {
                  scrollCollapsedByWeek(-1);
                  return;
                }
                onClick?.(event);
              }}
            />
          ),
          NextMonthButton: ({ onClick, ...props }) => (
            <button
              type="button"
              {...props}
              onClick={(event) => {
                if (isCollapsible && !isExpanded) {
                  scrollCollapsedByWeek(1);
                  return;
                }
                onClick?.(event);
              }}
            />
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
          Day: (props: {
            date: Date;
            onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
            className?: string;
            displayMonth?: Date;
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
                  onDateSelect?.(date);
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
          },
        }}
        styles={
          isCollapsible
            ? {
                tbody: { maxHeight: gridMaxHeight },
              }
            : undefined
        }
      />
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
        .filla-mini-calendar[data-collapsed="true"] .rdp-tbody {
          scroll-snap-type: y mandatory;
        }
        .filla-mini-calendar[data-collapsed="true"] .rdp-tbody .rdp-row {
          scroll-snap-align: start;
        }
      `}</style>
    </div>
  );
}
