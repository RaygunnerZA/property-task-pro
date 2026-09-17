import { cn } from "@/lib/utils";

export type HealthSecondaryTone = "urgent" | "warning" | "neutral";

export type WorkspaceHealthStat = {
  /** Single-line label; split on first space into two lines when line1/line2 omitted. */
  label?: string;
  line1?: string;
  line2?: string;
  value: number | string;
  /** Stat number colour (defaults to primary-deep / Tasks health ink). */
  color?: string;
  secondaryCount?: number;
  secondaryLabel?: string;
  secondaryTone?: HealthSecondaryTone;
  /** Makes the cell an interactive filter trigger. */
  onClick?: () => void;
  selected?: boolean;
};

export interface WorkspaceHealthGridProps {
  /** Up to three stats — extras are ignored so every rail stays a 3-panel strip. */
  stats: WorkspaceHealthStat[];
  className?: string;
  /** Tighter type/padding for narrow rails. */
  dense?: boolean;
  /** Accessible name for the strip. */
  ariaLabel?: string;
}

/** Scale display numbers so 3+ digits stay inside the cell with the label. */
export function healthStatNumberClass(
  value: number | string,
  dense = false
): string {
  const digits = String(value).replace(/\D/g, "").length;
  if (digits >= 3) return dense ? "text-sm" : "text-base";
  return dense ? "text-lg" : "text-[22px]";
}

export const healthStatCellClass =
  "group hover-ink-noise flex min-w-0 w-full flex-col items-start justify-start self-stretch rounded-xl bg-background/55 px-1.5 pb-2.5 pt-2.5 text-left shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.08),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]";

const secondaryCountBoxClass: Record<HealthSecondaryTone, string> = {
  urgent:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-destructive",
  warning:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-warning-foreground",
  neutral:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-muted-foreground",
};

const secondaryLabelClass: Record<HealthSecondaryTone, string> = {
  urgent:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-destructive transition-colors group-hover:text-accent",
  warning:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-warning-foreground transition-colors group-hover:text-amber-300",
  neutral:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-muted-foreground transition-colors group-hover:text-white/90",
};

const statWordClass =
  "block font-mono text-caption font-semibold uppercase leading-snug tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

function resolveLines(stat: WorkspaceHealthStat): { line1: string; line2: string } {
  if (stat.line1) {
    return { line1: stat.line1, line2: stat.line2 ?? "" };
  }
  const parts = String(stat.label ?? "").trim().split(/\s+/);
  if (parts.length <= 1) return { line1: parts[0] ?? "", line2: "" };
  return { line1: parts[0], line2: parts.slice(1).join(" ") };
}

/**
 * Standard 3-cell pressed health strip for activity-area left columns
 * (Tasks / Records / Spaces / Assets / People — number + two-line label).
 */
export function WorkspaceHealthGrid({
  stats,
  className,
  dense = true,
  ariaLabel = "Health",
}: WorkspaceHealthGridProps) {
  const row = stats.slice(0, 3);

  return (
    <div
      className={cn(
        "grid grid-cols-3 grid-rows-1 items-stretch gap-[3px] border-b border-border/30 py-[10px]",
        className
      )}
      role="navigation"
      aria-label={ariaLabel}
    >
      {row.map((stat, index) => {
        const { line1, line2 } = resolveLines(stat);
        const key = `${line1}-${line2}-${index}`;
        const cellClassName = cn(
          healthStatCellClass,
          dense ? "px-1 pb-2 pt-2" : "px-1.5 pb-2.5 pt-2.5",
          stat.onClick && "cursor-pointer",
          stat.selected && "bg-muted/40"
        );
        const numberClass = cn(
          "shrink-0 -translate-y-[6px] font-display font-medium tabular-nums leading-none text-shadow-neu-pressed transition-colors group-hover:text-white",
          healthStatNumberClass(stat.value, dense),
          !stat.color && "text-primary-deep"
        );
        const tone = stat.secondaryTone ?? "neutral";
        const inner = (
          <>
            <div className="flex w-full min-w-0 items-start gap-1 overflow-hidden pl-0.5">
              <span
                className={numberClass}
                style={stat.color ? { color: stat.color } : undefined}
              >
                {stat.value}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden pt-0.5 text-left [&>span+span]:-mt-[2px]">
                <span className={statWordClass}>{line1}</span>
                {line2 ? <span className={statWordClass}>{line2}</span> : null}
              </div>
            </div>
            {stat.secondaryLabel != null && stat.secondaryCount != null ? (
              <div className="mt-1.5 flex min-w-0 max-w-full items-center gap-0.5 overflow-hidden pl-0.5 tracking-[0.3px]">
                <span className={secondaryCountBoxClass[tone]}>{stat.secondaryCount}</span>
                <span className={cn(secondaryLabelClass[tone], "truncate")}>
                  {stat.secondaryLabel}
                </span>
              </div>
            ) : null}
          </>
        );
        return stat.onClick ? (
          <button
            key={key}
            type="button"
            onClick={stat.onClick}
            aria-pressed={stat.selected}
            className={cellClassName}
          >
            {inner}
          </button>
        ) : (
          <div key={key} className={cellClassName}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
