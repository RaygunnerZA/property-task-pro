import { cn } from "@/lib/utils";
import {
  TASK_STATUS_ORDER,
  TASK_STATUS_VISUALS,
  type TaskStatus,
} from "@/lib/taskStatus";

type StatusFilterIconStripProps = {
  selectedFilters: Set<string>;
  onFilterChange: (filterId: string, selected: boolean) => void;
  className?: string;
};

/** Quick strip statuses — Cancelled stays available under FILTER › Status, not here. */
const STRIP_STATUSES: TaskStatus[] = TASK_STATUS_ORDER.filter(
  (status) => status !== "archived"
);

const EXPAND_EASE = "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * Status toggles between FILTER and SORT.
 * Idle: icon-only. Hover/focus: expands to show the status name.
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
      {STRIP_STATUSES.map((status) => {
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
              "group/status inline-flex h-6 min-w-6 items-center overflow-hidden rounded-[8px]",
              "select-none cursor-pointer",
              "transition-[padding,gap,background-color,box-shadow]",
              EXPAND_EASE,
              "gap-0 pr-0",
              "hover:gap-1.5 hover:pr-2.5",
              "focus-visible:gap-1.5 focus-visible:pr-2.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
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
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  selected && status !== "open" ? "text-white" : visual.filterIconClassName
                )}
                strokeWidth={2.25}
                aria-hidden
              />
            </span>
            <span
              className={cn(
                "whitespace-nowrap overflow-hidden font-mono text-2xs uppercase tracking-wide",
                "max-w-0 opacity-0",
                "transition-[max-width,opacity]",
                EXPAND_EASE,
                "group-hover/status:max-w-[8rem] group-hover/status:opacity-100",
                "group-focus-visible/status:max-w-[8rem] group-focus-visible/status:opacity-100",
                selected && status !== "open"
                  ? "text-white"
                  : "text-muted-foreground"
              )}
            >
              {visual.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
