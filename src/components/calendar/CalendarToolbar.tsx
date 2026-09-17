import { addMonths, subMonths } from "date-fns";
import { CalendarDays } from "lucide-react";
import { SegmentedControl } from "@/components/filla/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CalendarMonthYearLabel,
  CalendarNavChevrons,
} from "@/components/calendar/CalendarMonthYearLabel";
import type { CalendarTaskScope } from "@/lib/calendarDayMeta";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

type CalendarToolbarProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onToday: () => void;
  taskScope: CalendarTaskScope;
  onTaskScopeChange: (scope: CalendarTaskScope) => void;
  className?: string;
};

const VIEW_OPTIONS = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  currentMonth,
  onMonthChange,
  onToday,
  taskScope,
  onTaskScopeChange,
  className,
}: CalendarToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-card px-3 py-2.5 shadow-e1",
        className
      )}
    >
      <SegmentedControl
        options={VIEW_OPTIONS}
        selectedId={viewMode}
        onChange={(id) => onViewModeChange(id as CalendarViewMode)}
      />

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <CalendarMonthYearLabel date={currentMonth} />
        <CalendarNavChevrons
          onPrev={() => onMonthChange(subMonths(currentMonth, 1))}
          onNext={() => onMonthChange(addMonths(currentMonth, 1))}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
          <CalendarDays className="h-4 w-4" />
        </Button>
        <Select
          value={taskScope}
          onValueChange={(value) => onTaskScopeChange(value as CalendarTaskScope)}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Calendar task scope">
            <SelectValue placeholder="All tasks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tasks</SelectItem>
            <SelectItem value="mine">My tasks</SelectItem>
            <SelectItem value="due">Due this week</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
