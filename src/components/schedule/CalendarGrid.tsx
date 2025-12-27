import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";

interface CalendarGridProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
}

export function CalendarGrid({ selectedDate, onDateSelect }: CalendarGridProps) {
  const { tasks, loading } = useTasks();

  // Create a map of dates to task counts
  const tasksByDate = useMemo(() => {
    const map = new Map<string, number>();
    
    tasks.forEach((task) => {
      if (task.due_date) {
        try {
          const date = new Date(task.due_date);
          const dateKey = format(date, "yyyy-MM-dd");
          map.set(dateKey, (map.get(dateKey) || 0) + 1);
        } catch {
          // Skip invalid dates
        }
      }
    });

    return map;
  }, [tasks]);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date): number => {
    const dateKey = format(date, "yyyy-MM-dd");
    return tasksByDate.get(dateKey) || 0;
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9] p-4 shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => onDateSelect?.(date)}
        className="w-full"
        modifiers={{
          hasTasks: datesWithTasks,
        }}
        modifiersClassNames={{
          hasTasks: "has-tasks",
        }}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center mb-2",
          caption_label: "text-sm font-semibold text-foreground",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-md hover:bg-accent transition-colors"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] font-mono",
          row: "flex w-full mt-2 mb-2 py-0 justify-start items-start font-mono",
          cell: "h-9 w-9 text-center text-sm p-0 relative font-mono",
          day: "h-9 w-9 p-0 font-normal font-mono relative rounded-full flex items-center justify-center",
          day_selected: "bg-[#8EC9CE] text-white hover:bg-[#8EC9CE] hover:text-white focus:bg-[#8EC9CE] focus:text-white",
          day_today: "bg-accent/30 text-accent-foreground font-semibold",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
        }}
      />
      <style>{`
        .rdp-day.has-tasks::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: #8EC9CE;
        }
        .rdp-day_selected.has-tasks::after {
          background-color: white;
        }
      `}</style>
    </div>
  );
}
