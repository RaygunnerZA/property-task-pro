import { addMonths, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

type CalendarToolbarProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onToday: () => void;
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

      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 text-accent" />
        </button>
        <CalendarMonthYearLabel
          date={currentMonth}
          className="min-w-[88px] justify-center"
        />
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 text-accent" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
          <CalendarDays className="h-4 w-4" />
        </Button>
        <Select defaultValue="all">
          <SelectTrigger className="h-8 w-[120px] text-xs">
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
