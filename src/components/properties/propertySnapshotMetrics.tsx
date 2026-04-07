import { cn } from "@/lib/utils";

/** Label column for snapshot rows (icon + text), aligned with PropertyIdentityStrip. */
export const summaryRowLabelClass =
  "flex w-[105px] shrink-0 items-center gap-2 text-xs text-muted-foreground";

/** Full-width grid: primary count, divider bar, secondary + ⚠ when attention &gt; 0 (compact). */
export const summaryMetricsGridClass =
  "grid min-w-0 w-[86px] shrink-0 grid-cols-[minmax(0,3rem)_minmax(0,12px)_max-content_minmax(0,1fr)] items-center gap-x-0 gap-y-0 pr-1 text-xs tabular-nums";

/** Wider grid when secondary shows full words (e.g. "2 Urgent") instead of ⚠️. */
export const summaryMetricsGridClassWords =
  "grid min-w-0 flex-1 min-w-0 grid-cols-[minmax(0,2.75rem)_minmax(0,10px)_max-content_minmax(0,1fr)] items-center gap-x-0.5 gap-y-0 pr-0.5 text-xs tabular-nums";

export const metricVBarClass =
  "h-[11px] w-0.5 shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]";

export const summaryActionCol =
  "flex h-6 shrink-0 w-[55px] items-center justify-end gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto max-sm:opacity-100 max-sm:pointer-events-auto";

const metricPillClass =
  "flex h-6 w-6 min-w-0 flex-col items-center justify-center justify-self-end rounded-lg bg-white font-semibold tabular-nums shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]";

const metricSecondaryPillClass =
  "flex h-6 min-w-0 w-7 shrink-0 items-center justify-end gap-0.5 rounded-lg bg-white px-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]";

const metricSecondaryWordsPillClass =
  "flex h-6 min-w-0 shrink items-center justify-center gap-1 rounded-lg bg-white px-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]";

/** Primary in fixed column; white bar; secondary count + ⚠ or words when attention &gt; 0. */
export function StripMetricValue({
  primary,
  attention,
  primaryMuted,
  primaryClassName,
  attentionTitle,
  warnClassName = "text-red-600/85",
  attentionBadgeVariant = "symbol",
  attentionShortLabel,
}: {
  primary: number | string;
  attention: number;
  primaryMuted?: boolean;
  /** e.g. text-destructive when primary is a risk count */
  primaryClassName?: string;
  attentionTitle?: string;
  warnClassName?: string;
  /**
   * symbol: "n ⚠️" when space is tight (default).
   * words: "n" + short label (e.g. "Urgent", "Need attention") when the strip is wide enough.
   */
  attentionBadgeVariant?: "symbol" | "words";
  /** Shown next to the count when `attentionBadgeVariant` is "words" (e.g. "Urgent"). */
  attentionShortLabel?: string;
}) {
  const showSecondary = attention > 0;
  const useWords = attentionBadgeVariant === "words" && !!attentionShortLabel?.trim();

  return (
    <div
      className={cn(
        useWords && showSecondary ? summaryMetricsGridClassWords : summaryMetricsGridClass
      )}
    >
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
        useWords ? (
          <div
            className={metricSecondaryWordsPillClass}
            title={attentionTitle ?? ""}
            aria-label={attentionTitle ?? `${attention} ${attentionShortLabel ?? ""}`}
          >
            <span className="font-semibold font-mono tabular-nums text-[#EB6834]">{attention}</span>
            <span className="text-[11px] font-medium text-[#EB6834] leading-tight whitespace-nowrap">
              {attentionShortLabel}
            </span>
          </div>
        ) : (
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
        )
      ) : (
        <div className="h-6 w-7 min-w-0 shrink-0" aria-hidden />
      )}
      <div className="min-w-0" aria-hidden />
    </div>
  );
}
