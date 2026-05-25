import { cn } from "@/lib/utils";

export type SignalConfidenceLevel = "low" | "medium" | "high";

export type SignalCategoryVariant = "maintenance" | "inspection" | "tenant" | "default";

const confidenceConfig: Record<
  SignalConfidenceLevel,
  { label: string; filledBars: number; barColor: string }
> = {
  low: { label: "Low confidence", filledBars: 1, barColor: "bg-destructive/80" },
  medium: { label: "Medium confidence", filledBars: 2, barColor: "bg-amber-500/85" },
  high: { label: "High confidence", filledBars: 3, barColor: "bg-primary/80" },
};

export function SignalConfidenceIndicator({ level }: { level: SignalConfidenceLevel }) {
  const config = confidenceConfig[level];
  return (
    <div
      className="hidden h-7 min-w-[5.5rem] shrink-0 items-center gap-1.5 self-center sm:flex"
      title={config.label}
      aria-label={config.label}
    >
      <span className="text-[10px] leading-none text-muted-foreground whitespace-nowrap">{config.label}</span>
      <div className="flex h-3 items-center gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-3 rounded-full",
              i < config.filledBars ? config.barColor : "bg-muted/80"
            )}
          />
        ))}
      </div>
    </div>
  );
}

const categoryVariantClass: Record<SignalCategoryVariant, string> = {
  maintenance: "bg-primary/30 text-[#0d9488]",
  inspection: "bg-violet-500/15 text-violet-700",
  tenant: "bg-destructive/12 text-destructive",
  default: "bg-muted/60 text-muted-foreground",
};

export function SignalCategoryTag({
  label,
  variant = "default",
}: {
  label: string;
  variant?: SignalCategoryVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center justify-center rounded-[5px] px-2.5 font-mono text-[11px] font-medium",
        categoryVariantClass[variant]
      )}
    >
      {label}
    </span>
  );
}

/** Shared 8px corner radius + height for Issues signal row controls. */
const issuesSignalControlRadius = "rounded-[8px]";

/** Secondary actions (View / Dismiss) on signal rows. */
export const issuesSignalSecondaryButtonClassName = cn(
  "inline-flex h-7 shrink-0 items-center justify-center border border-border/60 bg-[rgb(237,235,232)]",
  issuesSignalControlRadius,
  "px-3 text-[11px] font-medium text-foreground",
  "shadow-[1px_2px_3px_0px_rgba(0,0,0,0.15),-1px_-2px_3px_0px_rgba(255,255,255,0.7),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
  "transition-colors hover:bg-muted/40"
);

/** Primary Review CTA — teal. */
export const issuesSignalReviewButtonClassName = cn(
  "inline-flex h-7 shrink-0 items-center justify-center border-0 bg-[#8DC9CE]",
  issuesSignalControlRadius,
  "px-3 text-[11px] font-semibold text-white",
  "shadow-primary-btn transition-all hover:bg-[#85BABC] active:shadow-btn-pressed"
);

/** Overflow (⋯) control — same footprint as row buttons. */
export const issuesSignalOverflowButtonClassName = cn(
  "inline-flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-white/82",
  issuesSignalControlRadius,
  "text-muted-foreground",
  "transition-colors hover:bg-muted/40 hover:text-foreground"
);
