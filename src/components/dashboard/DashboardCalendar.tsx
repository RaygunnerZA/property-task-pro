import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format, format as formatDate, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { CardButton, cardButtonClassName } from "@/components/design-system/CardButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarStrip } from "@/components/dashboard/CalendarStrip";

interface DashboardCalendarProps {
  tasks?: any[];
  selectedDate?: Date | undefined;
  onDateSelect?: (date: Date | undefined) => void;
  className?: string;
  tasksByDate?: Map<string, {
    total: number;
    high: number;
    urgent: number;
    overdue: number;
  }>;
}

/**
 * DashboardCalendar
 * 
 * Primary calendar component with Heat Map Fill visualization.
 * Displays task counts, urgency, and overdue status using filled circles.
 * 
 * Props:
 * - tasks: Array of task objects with due_date/due_at, status, priority
 * - selectedDate: Currently selected date
 * - onDateSelect: Callback when a date is selected
 * - className: Optional additional CSS classes
 */
export function DashboardCalendar({
  tasks = [],
  selectedDate,
  onDateSelect,
  className,
  tasksByDate: providedTasksByDate,
}: DashboardCalendarProps) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [activeDate, setActiveDate] = useState<Date>(selectedDate || new Date());

  useEffect(() => {
    setIsCollapsed(isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (selectedDate) {
      setActiveDate(selectedDate);
    }
  }, [selectedDate]);
  // Removed excessive debug logging to prevent re-render performance issues
  // Normalize priority: treat null, undefined, 'normal', and 'medium' as the same
  const normalizePriority = (priority: string | null | undefined): string => {
    if (!priority) return 'normal';
    const normalized = priority.toLowerCase();
    if (normalized === 'medium') return 'normal';
    return normalized;
  };

  // Use provided tasksByDate if available, otherwise calculate it (for backward compatibility)
  const tasksByDate = useMemo(() => {
    if (providedTasksByDate) {
      return providedTasksByDate;
    }
    
    // Fallback: calculate from tasks if not provided
    const map = new Map<string, {
      total: number;
      high: number;
      urgent: number;
      overdue: number;
    }>();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    tasks.forEach((task) => {
      const dueDateValue = task.due_date || task.due_at;
      if (dueDateValue && task.status !== 'completed' && task.status !== 'archived') {
        try {
          const date = new Date(dueDateValue);
          const isValidDate = !isNaN(date.getTime());
          if (!isValidDate) {
            return;
          }
          const dateKey = format(date, "yyyy-MM-dd");
          const current = map.get(dateKey) || { total: 0, high: 0, urgent: 0, overdue: 0 };
          
          current.total += 1;
          
          const priority = normalizePriority(task.priority);
          
          if (priority === 'high') {
            current.high += 1;
          } else if (priority === 'urgent') {
            current.urgent += 1;
          }
          
          // Check if overdue
          date.setHours(0, 0, 0, 0);
          if (date < today) {
            current.overdue += 1;
          }
          
          map.set(dateKey, current);
        } catch {
          // Skip invalid dates
        }
      }
    });


    return map;
  }, [providedTasksByDate, tasks]);

  // Get dates that have tasks for styling
  const datesWithTasks = useMemo(() => {
    return Array.from(tasksByDate.keys()).map((key) => {
      try {
        const [year, month, day] = key.split("-").map(Number);
        return new Date(year, month - 1, day);
      } catch {
        return null;
      }
    }).filter((date): date is Date => date !== null);
  }, [tasksByDate]);

  // Custom CaptionLabel component that only shows month
  const CustomCaptionLabel = (props: { displayMonth: Date }) => {
    return (
      <span className="text-2xl font-semibold text-foreground">
        {formatDate(props.displayMonth, "MMMM")}
      </span>
    );
  };

  const handleDatePress = (date: Date) => {
    setIsScheduleMode(true);
    setActiveDate(date);
    onDateSelect?.(date);
  };

  const handleActiveDateChange = (date: Date) => {
    setActiveDate(date);
    if (isScheduleMode) {
      onDateSelect?.(date);
    }
  };

  return (
    <div className={cn("w-full relative", className)}>
      {isMobile && (
        <div className="absolute right-0 top-0 z-10">
          <CardButton
            aria-label={isCollapsed ? "Expand calendar" : "Collapse calendar"}
            className="h-8 w-8"
            onClick={() => setIsCollapsed((prev) => !prev)}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </CardButton>
        </div>
      )}

      {isMobile && isCollapsed ? (
        <div className="space-y-2">
          <div className="text-2xl font-semibold text-foreground text-center">
            {formatDate(activeDate, "MMMM")}
          </div>
          <CalendarStrip
            activeDate={activeDate}
            mode={isScheduleMode ? "schedule" : "browse"}
            onActiveDateChange={handleActiveDateChange}
            onDatePress={handleDatePress}
            tasksByDate={tasksByDate}
          />
        </div>
      ) : (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          className="w-full"
          classNames={{
            months: "flex flex-col space-y-4",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center mb-2 mr-[-5px]",
            caption_label: "text-2xl font-semibold text-foreground",
            nav: "space-x-1 flex items-center",
            nav_button: cardButtonClassName,
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-separate border-spacing-2 mt-[5px]",
            head_row: "grid grid-cols-7 gap-2",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] font-mono text-center",
            row: "grid grid-cols-7 gap-2",
            cell: "flex h-[35px] w-[35px] items-center justify-center font-mono text-sm mt-[2px] mb-[2px]",
            day: "h-[35px] w-[35px] p-0 font-normal font-mono text-sm relative rounded-full grid items-center justify-center",
            day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
            day_today: "bg-white text-foreground font-semibold",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
          modifiers={{
            hasTasks: datesWithTasks,
          }}
          modifiersClassNames={{
            hasTasks: "has-tasks",
          }}
          components={{
            IconLeft: () => <ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2.5} />,
            IconRight: () => <ChevronRight className="h-6 w-6 text-foreground" strokeWidth={2.5} />,
            CaptionLabel: CustomCaptionLabel,
            Day: (props: any) => {
              const { date, onClick, className: propClassName, displayMonth, ...restProps } = props;
              const dateKey = format(date, "yyyy-MM-dd");
              const dateData = tasksByDate.get(dateKey);
              const taskCount = dateData?.total || 0;
              const highCount = dateData?.high || 0;
              const urgentCount = dateData?.urgent || 0;
              const overdueCount = dateData?.overdue || 0;
              const hasTasks = taskCount > 0;
              const isTodayDate = isToday(date);
              const isSelected = selectedDate ? isSameDay(selectedDate, date) : false;

              // Determine fill color based on task count and priorities
              let fillColor = "";

              if (hasTasks) {
                // Priority: Overdue/Urgent takes precedence
                const totalUrgentOrOverdue = urgentCount + overdueCount;

                if (totalUrgentOrOverdue >= 3) {
                  // 3+ Urgent/Overdue: Red fill
                  fillColor = "rgba(220, 38, 38, 0.6)";
                } else if (highCount >= 3) {
                  // 3+ High: Orange fill
                  fillColor = "rgba(245, 138, 48, 0.6)";
                } else if (totalUrgentOrOverdue >= 1 || highCount >= 1) {
                  // 1-2 Urgent/High: Lighter red/orange
                  fillColor = totalUrgentOrOverdue > 0
                    ? "rgba(220, 38, 38, 0.4)"
                    : "rgba(245, 138, 48, 0.4)";
                } else {
                  // Normal tasks: Teal fill with opacity based on count
                  if (taskCount >= 4) {
                    fillColor = "rgba(78, 179, 182, 0.6)";
                  } else if (taskCount >= 2) {
                    fillColor = "rgba(78, 179, 182, 0.5)";
                  } else {
                    fillColor = "rgba(78, 179, 182, 0.4)";
                  }
                }
              }

              const finalClassName = cn(
                propClassName,
                hasTasks && "has-tasks",
                isTodayDate && "is-today"
              );

              const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
                if (onClick) {
                  onClick(e);
                }
                onDateSelect?.(date);
              };

              return (
                <button
                  {...restProps}
                  onClick={handleClick}
                  className={finalClassName}
                  data-task-count={taskCount}
                  data-high-count={highCount}
                  data-urgent-count={urgentCount}
                  data-overdue-count={overdueCount}
                  data-date-key={dateKey}
                  style={{
                    width: "35px",
                    height: "35px",
                    backgroundColor: !isSelected
                      ? (isTodayDate ? "#ffffff" : (fillColor || undefined))
                      : undefined,
                    borderRadius: "9999px",
                    ...(hasTasks ? {
                      boxShadow: "inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)"
                    } : {})
                  }}
                >
                  {date.getDate()}
                </button>
              );
            },
          }}
        />
      )}
      <style>{`
        /* Ensure cells are properly styled with max border radius */
        .rdp-cell {
          border-radius: 9999px !important;
        }
        
        /* Ensure day buttons maintain circular shape and proper layering */
        .rdp-day,
        button.rdp-day {
          border-radius: 9999px !important;
          position: relative !important;
          z-index: 1 !important;
          display: grid !important;
          align-items: center !important;
          justify-items: center !important;
        }
        
        /* Neumorphic pressed effect for days with tasks (priority fill circles) */
        /* Stronger inner shadow for pressed effect - top-left (darker), bottom-right (lighter) */
        button.rdp-day.has-tasks {
          position: relative !important;
          box-shadow: inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), 
                      inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17) !important;
        }

        /* Match preview: if a has-tasks day doesn't have an inline background-color, give it a subtle surface fill */
        button.rdp-day.has-tasks:not([style*="background-color"]) {
          background-color: #F6F4F2;
        }

        /* Match preview: reduce DayPicker table top margin (react-day-picker defaults to ~16px) */
        table.rdp-table {
          margin-top: 5px !important;
        }
        
        /* Add overlay pseudo-element for additional depth on pressed effect */
        button.rdp-day.has-tasks::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
          pointer-events: none;
          z-index: 1;
        }
        
        /* Ensure text is above background and overlay */
        .rdp-day > * {
          position: relative !important;
          z-index: 2 !important;
        }
        
        /* Ensure date number text is above overlay for has-tasks buttons */
        button.rdp-day.has-tasks > * {
          position: relative !important;
          z-index: 2 !important;
        }
        
        /* Selected day styling - ensure it's visible above fills */
        .rdp-day_selected {
          z-index: 2 !important;
        }
        
        /* Ensure proper vertical centering */
        .rdp-cell,
        td.rdp-cell,
        td.h-9 {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
      `}</style>
    </div>
  );
}
