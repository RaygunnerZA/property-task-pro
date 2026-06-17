import { useMemo } from "react";
import { PropertyIdentityStrip } from "@/components/properties/PropertyIdentityStrip";
import { PropertySelectorStack } from "@/components/properties/PropertySelectorStack";
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!propertiesLoading && properties.length > 1 ? (
        <PropertySelectorStack
          properties={properties}
          tasks={displayTasks}
          selectedPropertyIds={selectedPropertyIds}
          onSelectionChange={onPropertySelectionChange}
        />
      ) : null}

      <div className="min-h-0 shrink-0">
        {propertiesLoading ? (
          <Skeleton className="h-[200px] w-full rounded-xl" />
        ) : focusedProperty ? (
          <PropertyIdentityStrip property={focusedProperty} />
        ) : properties.length === 1 ? (
          <PropertyIdentityStrip property={properties[0]} />
        ) : null}
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
