import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  format as formatDate,
  isSameDay,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildTasksByDate,
  dayCellBackground,
  dayDotColor,
  type DayUrgency,
  type TaskDateData,
} from "@/lib/calendarDayMeta";

function resolveDayUrgency(data: TaskDateData | undefined): DayUrgency {
  if (!data || data.total === 0) return "none";
  if (data.maxUrgency && data.maxUrgency !== "none") return data.maxUrgency;
  if (data.overdue > 0) return "overdue";
  if (data.urgent > 0) return "urgent";
  if (data.high > 0) return "high";
  return "normal";
}
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";

/** Neomorphic depth for mini-calendar day cells with task fill */
const MINI_CALENDAR_DAY_SHADOW =
  "1px 2px 1px 0px rgba(255, 255, 255, 0.8), inset 1.5px 2px 2.4px 0px rgba(0, 0, 0, 0.2), -1px -1px 1px 0px rgba(0, 0, 0, 0.1)";

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

  return (
    <div
      className={cn(
        "filla-mini-calendar w-full",
        variant === "sidebar" &&
          "max-w-[250px] rounded-xl border border-border/40 bg-card/60 p-3 shadow-e1",
        className
      )}
    >
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        month={month}
        onMonthChange={onMonthChange}
        className={cn(
          isEmbedded ? "max-w-[247px]" : "max-w-[250px] w-full"
        )}
        classNames={{
          months: "flex flex-col w-full",
          month: "space-y-3 w-full",
          caption: "flex justify-between items-center px-0.5 mb-1",
          caption_label: cn(
            "font-semibold text-foreground",
            isEmbedded ? "text-base" : "text-sm"
          ),
          nav: "flex items-center gap-1",
          nav_button: cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
          ),
          nav_button_previous: "",
          nav_button_next: "",
          table: "w-full border-collapse",
          head_row: "flex w-full justify-between mb-1",
          head_cell: cn(
            "flex-1 text-center font-mono font-medium uppercase text-foreground",
            "[&:nth-child(6)]:text-muted-foreground/50 [&:nth-child(7)]:text-muted-foreground/50",
            isEmbedded ? "text-[0.65rem]" : "text-[10px]"
          ),
          row: "flex w-full justify-between mt-0.5",
          cell: cn(
            "relative flex flex-1 items-center justify-center p-0 text-center",
            isEmbedded ? "h-[30px]" : "h-8"
          ),
          day: cn(
            "relative flex flex-col items-center justify-center rounded-[5px] font-medium transition-colors",
            isEmbedded ? "h-6 w-6 text-xs" : "h-6 w-6 text-sm"
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
          IconLeft: () => <ChevronLeft className="h-4 w-4 text-accent" strokeWidth={2.2} />,
          IconRight: () => <ChevronRight className="h-4 w-4 text-accent" strokeWidth={2.2} />,
          CaptionLabel: ({ displayMonth }) => (
            <CalendarMonthYearLabel
              date={displayMonth}
              monthClassName={cn(
                "font-semibold text-ink",
                isEmbedded ? "text-base" : "text-lg"
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
                className={cn(propClassName, "relative h-6 w-6 font-mono rounded-[5px]")}
                style={{
                  backgroundColor: fill,
                  ...(fill ? { boxShadow: MINI_CALENDAR_DAY_SHADOW } : undefined),
                }}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium",
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
      />
    </div>
  );
}
