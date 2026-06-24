import { useMemo } from "react";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { buildTasksByDate } from "@/lib/calendarDayMeta";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CentreWorkbenchMobileCalendarProps = {
  tasks?: any[];
  properties?: { id: string }[];
  tasksLoading?: boolean;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  selectedPropertyIds?: Set<string>;
  className?: string;
};

/**
 * Same FillaMiniCalendar as the left rail, for mobile centre column (Inflow · Tasks).
 * Defaults to the compressed week-strip slider; expand via the calendar header control.
 */
export function CentreWorkbenchMobileCalendar({
  tasks = [],
  properties = [],
  tasksLoading = false,
  selectedDate,
  onDateSelect,
  selectedPropertyIds,
  className,
}: CentreWorkbenchMobileCalendarProps) {
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const calendarTasks = useMemo(() => {
    if (properties.length === 0 || isAllPropertiesActive(selectedPropertyIds, allPropertyIds)) {
      return tasks;
    }
    return tasks.filter(
      (task) => task.property_id && selectedPropertyIds?.has(task.property_id)
    );
  }, [allPropertyIds, properties.length, selectedPropertyIds, tasks]);

  const tasksByDate = useMemo(() => buildTasksByDate(calendarTasks), [calendarTasks]);

  return (
    <div className={cn("mb-3 w-full md:hidden", className)}>
      <div className="w-full max-w-full rounded-lg bg-transparent px-0 pt-1 pb-1 pr-0 shadow-none">
        {tasksLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <FillaMiniCalendar
            tasks={calendarTasks}
            tasksByDate={tasksByDate}
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            defaultExpanded={false}
            collapseOnDateSelect
            className="bg-transparent px-0 py-px shadow-none"
          />
        )}
      </div>
    </div>
  );
}
