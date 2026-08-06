import { cn } from "@/lib/utils";
import {
  TASK_STATUS_ORDER,
  TASK_STATUS_VISUALS,
} from "@/lib/taskStatus";

type StatusFilterIconStripProps = {
  selectedFilters: Set<string>;
  onFilterChange: (filterId: string, selected: boolean) => void;
  className?: string;
};

/**
 * Icon-only status toggles between FILTER and SORT:
 * [◯] [◌] [⏸] [✔︎] [x]
 */
export function StatusFilterIconStrip({
  selectedFilters,
  onFilterChange,
  className,
}: StatusFilterIconStripProps) {
  return (
    <div
      className={cn("inline-flex shrink-0 items-center gap-[6px]", className)}
      role="group"
      aria-label="Filter by status"
    >
      {TASK_STATUS_ORDER.map((status) => {
        const visual = TASK_STATUS_VISUALS[status];
        const selected = selectedFilters.has(visual.filterId);
        const Icon = visual.Icon;
        return (
          <button
            key={visual.filterId}
            type="button"
            title={visual.label}
            aria-label={visual.label}
            aria-pressed={selected}
            onClick={() => onFilterChange(visual.filterId, !selected)}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-[8px] transition-all",
              "select-none cursor-pointer",
              selected
                ? cn(
                    visual.blockClassName,
                    "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.18)]"
                  )
                : cn(
                    "bg-background",
                    "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-1px_-1px_2px_0px_rgba(255,255,255,0.85)]",
                    "hover:bg-card"
                  )
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                selected && status !== "open" ? "text-white" : visual.filterIconClassName
              )}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
