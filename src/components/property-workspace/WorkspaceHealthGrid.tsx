import { cn } from "@/lib/utils";

export type WorkspaceHealthStat = {
  label: string;
  value: number | string;
  /** Stat number colour (defaults to foreground ink). */
  color?: string;
  /** Makes the cell an interactive filter trigger. */
  onClick?: () => void;
  selected?: boolean;
};

export interface WorkspaceHealthGridProps {
  /** Exactly four stats for the standard activity-area dashboard row. */
  stats: WorkspaceHealthStat[];
  className?: string;
  /** Tighter type/padding for narrow rails. */
  dense?: boolean;
}

/**
 * Standard 4-cell pressed stat grid for activity-area left columns
 * (same grammar as the Records "Property Health" summary).
 */
export function WorkspaceHealthGrid({
  stats,
  className,
  dense = true,
}: WorkspaceHealthGridProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-1", className)}>
      {stats.map((stat) => {
        const cellClassName = cn(
          "flex min-w-0 flex-col items-center justify-center rounded-xl bg-transparent text-center",
          dense ? "px-0.5 py-1.5" : "px-0.5 py-2",
          "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]",
          stat.onClick && "cursor-pointer transition-colors hover:bg-muted/30",
          stat.selected && "bg-muted/40"
        );
        const inner = (
          <>
            <p
              className={cn(
                "font-display font-medium leading-none tabular-nums text-shadow-neu-pressed",
                dense ? "text-[18px]" : "text-[22px]"
              )}
              style={{ color: stat.color ?? "rgb(42, 41, 62)" }}
            >
              {stat.value}
            </p>
            <p className="mt-0.5 max-w-full truncate text-2xs leading-tight text-muted-foreground">
              {stat.label}
            </p>
          </>
        );
        return stat.onClick ? (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            aria-pressed={stat.selected}
            className={cellClassName}
          >
            {inner}
          </button>
        ) : (
          <div key={stat.label} className={cellClassName}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
