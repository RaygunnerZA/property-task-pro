import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CALENDAR_TYPES,
  type CalendarTypeId,
} from "@/lib/calendarTypes";

type CalendarTypeFiltersProps = {
  selected: Set<CalendarTypeId>;
  onChange: (next: Set<CalendarTypeId>) => void;
  className?: string;
};

export function CalendarTypeFilters({
  selected,
  onChange,
  className,
}: CalendarTypeFiltersProps) {
  const toggle = (id: CalendarTypeId) => {
    const next = new Set(selected);
    if (id === "all") {
      if (next.has("all")) {
        onChange(new Set());
      } else {
        onChange(new Set(CALENDAR_TYPES.map((t) => t.id)));
      }
      return;
    }
    next.delete("all");
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) {
      onChange(new Set(["all"]));
      return;
    }
    onChange(next);
  };

  const isChecked = (id: CalendarTypeId) =>
    selected.has("all") || selected.has(id) || selected.size === 0;

  return (
    <div
      className={cn(
        "rounded-xl p-3",
        className
      )}
    >
      <h3 className="mb-2.5 text-sm font-semibold text-foreground">Calendars</h3>
      <ul className="space-y-2">
        {CALENDAR_TYPES.map((type) => {
          const checked = isChecked(type.id);
          return (
            <li key={type.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
                <span
                  className={cn(
                    "flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                    checked ? "border-transparent text-white" : "border-border bg-background"
                  )}
                  style={
                    checked
                      ? { backgroundColor: type.checkboxColor }
                      : undefined
                  }
                >
                  {checked ? (
                    <svg width="6" height="4" viewBox="0 0 10 8" fill="none" aria-hidden>
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(type.id)}
                />
                {type.label}
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        disabled
        title="Coming soon"
      >
        <Plus className="h-3.5 w-3.5" />
        Add calendar
      </button>
    </div>
  );
}
