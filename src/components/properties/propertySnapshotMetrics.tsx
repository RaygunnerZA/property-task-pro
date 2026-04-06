import { cn } from "@/lib/utils";

/** Label column for snapshot rows (icon + text), aligned with PropertyIdentityStrip. */
export const summaryRowLabelClass =
  "flex w-[105px] shrink-0 items-center gap-2 text-xs text-muted-foreground";

/** Full-width grid: primary count, divider bar, secondary + ⚠ when attention &gt; 0. */
export const summaryMetricsGridClass =
  "grid min-w-0 w-[86px] shrink-0 grid-cols-[minmax(0,3rem)_minmax(0,12px)_max-content_minmax(0,1fr)] items-center gap-x-0 gap-y-0 pr-1 text-xs tabular-nums";

export const metricVBarClass =
  "h-[11px] w-0.5 shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]";

export const summaryActionCol =
  "flex h-6 shrink-0 w-[55px] items-center justify-end gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto";

const metricPillClass =
  "flex h-6 w-6 min-w-0 flex-col items-center justify-center justify-self-end rounded-lg bg-white font-semibold tabular-nums shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]";

const metricSecondaryPillClass =
  "flex h-6 min-w-0 w-7 shrink-0 items-center justify-end gap-0.5 rounded-lg bg-white px-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]";

/** Primary in fixed column; white bar; secondary count + ⚠ when attention &gt; 0. */
export function StripMetricValue({
  primary,
  attention,
  primaryMuted,
  primaryClassName,
  attentionTitle,
  warnClassName = "text-red-600/85",
}: {
  primary: number | string;
  attention: number;
  primaryMuted?: boolean;
  /** e.g. text-destructive when primary is a risk count */
  primaryClassName?: string;
  attentionTitle?: string;
  warnClassName?: string;
}) {
  const showSecondary = attention > 0;
  return (
    <div className={summaryMetricsGridClass}>
      <div className={cn(metricPillClass)}>
        <span
          className={cn(
            primaryMuted ? "text-muted-foreground" : "font-mono text-[rgb(42,41,62)]",
            primaryClassName
          )}
        >
          {primary}
        </span>
      </div>
      <div className="flex items-center justify-center">
        {showSecondary ? <span className={metricVBarClass} aria-hidden /> : null}
      </div>
      {showSecondary ? (
        <div className={metricSecondaryPillClass}>
          <span className="font-semibold font-mono tabular-nums text-[#EB6834]">{attention}</span>
          <span
            className={cn("font-medium", warnClassName)}
            title={attentionTitle ?? ""}
            aria-label={attentionTitle ?? "Attention"}
          >
            ⚠
          </span>
        </div>
      ) : (
        <div className="h-6 w-7 min-w-0 shrink-0" aria-hidden />
      )}
      <div className="min-w-0" aria-hidden />
    </div>
  );
}
