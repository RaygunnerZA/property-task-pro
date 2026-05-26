import { useMemo } from "react";
import { PropertyScopeFilterBar } from "@/components/properties/PropertyScopeFilterBar";
import { PropertyIdentityStrip } from "@/components/properties/PropertyIdentityStrip";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { CalendarTypeFilters } from "@/components/calendar/CalendarTypeFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { buildTasksByDate } from "@/lib/calendarDayMeta";
import type { CalendarTypeId } from "@/lib/calendarTypes";
import { isAllPropertiesActive } from "@/utils/propertyFilter";

type CalendarLeftColumnProps = {
  properties: any[];
  propertiesLoading?: boolean;
  /** Tasks after property, calendar-type, search, and header filter scope. */
  displayTasks: any[];
  tasksLoading?: boolean;
  selectedPropertyIds: Set<string>;
  onPropertySelectionChange: (ids: Set<string>) => void;
  selectedDate?: Date;
  onDateSelect: (date: Date | undefined) => void;
  calendarMonth: Date;
  onCalendarMonthChange: (month: Date) => void;
  selectedCalendarTypes: Set<CalendarTypeId>;
  onCalendarTypesChange: (types: Set<CalendarTypeId>) => void;
};

export function CalendarLeftColumn({
  properties,
  propertiesLoading,
  displayTasks,
  tasksLoading,
  selectedPropertyIds,
  onPropertySelectionChange,
  selectedDate,
  onDateSelect,
  calendarMonth,
  onCalendarMonthChange,
  selectedCalendarTypes,
  onCalendarTypesChange,
}: CalendarLeftColumnProps) {
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const tasksByDate = useMemo(() => buildTasksByDate(displayTasks), [displayTasks]);

  const focusedProperty = useMemo(() => {
    if (
      properties.length === 0 ||
      isAllPropertiesActive(selectedPropertyIds, allPropertyIds) ||
      selectedPropertyIds.size !== 1
    ) {
      return null;
    }
    const id = Array.from(selectedPropertyIds)[0];
    return properties.find((p) => p.id === id) ?? null;
  }, [properties, selectedPropertyIds, allPropertyIds]);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p: { id: string; open_tasks_count?: number }) => {
      counts[p.id] = p.open_tasks_count ?? 0;
    });
    return counts;
  }, [properties]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {properties.length > 1 && (
        <PropertyScopeFilterBar
          variant="primary"
          placement="leftColumn"
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          onSelectionChange={onPropertySelectionChange}
        />
      )}

      <div className="min-h-0 shrink-0">
        {propertiesLoading ? (
          <Skeleton className="h-[200px] w-full rounded-xl" />
        ) : focusedProperty ? (
          <PropertyIdentityStrip property={focusedProperty} />
        ) : properties.length === 1 ? (
          <PropertyIdentityStrip property={properties[0]} />
        ) : (
          <div className="overflow-x-auto scrollbar-hz-teal">
            <div className="flex gap-3 pb-1" style={{ width: "max-content" }}>
              {properties.slice(0, 6).map((property) => (
                <div key={property.id} className="w-[180px] shrink-0">
                  <PropertyCard
                    property={{
                      ...property,
                      taskCount: taskCounts[property.id] ?? 0,
                      urgentTaskCount: 0,
                      lastInspectedDate: null,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {tasksLoading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <FillaMiniCalendar
          tasksByDate={tasksByDate}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          month={calendarMonth}
          onMonthChange={onCalendarMonthChange}
        />
      )}

      <CalendarTypeFilters
        selected={selectedCalendarTypes}
        onChange={onCalendarTypesChange}
        className="shrink-0"
      />
    </div>
  );
}
