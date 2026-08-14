/**
 * Assets left-rail metrics — same three-block grammar as the home property snapshot
 * (large number, two-line label, chevron, optional status chip).
 */
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

export type AssetMetricKey = "active" | "needsInspection" | "nonCompliant" | "retired";

type StatSecondaryTone = "urgent" | "warning" | "neutral";

const statNumberClass =
  "self-start pl-1.5 pb-1 text-[32px] font-medium tabular-nums leading-none text-primary-deep transition-colors group-hover:text-white sm:pb-[3px] sm:text-2xl";

const statWordClass =
  "font-mono text-caption font-semibold uppercase leading-tight tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

const statCellClass =
  "group flex min-w-0 w-full flex-col items-start justify-start self-start rounded-xl bg-background/55 px-2 pb-3 pt-3 text-left shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.08),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-ink hover:shadow-none active:scale-[0.98] sm:px-1.5 sm:pb-3";

const secondaryCountBoxClass: Record<StatSecondaryTone, string> = {
  urgent:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-destructive",
  warning:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-warning-foreground",
  neutral:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-muted-foreground",
};

const secondaryLabelClass: Record<StatSecondaryTone, string> = {
  urgent:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-destructive transition-colors group-hover:text-accent",
  warning:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-warning-foreground transition-colors group-hover:text-amber-300",
  neutral:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-muted-foreground transition-colors group-hover:text-white/90",
};

function MetricBlock({
  value,
  line1,
  line2,
  secondaryCount,
  secondaryLabel,
  secondaryTone,
  selected,
  onClick,
}: {
  value: number;
  line1: string;
  line2: string;
  secondaryCount: number;
  secondaryLabel: string;
  secondaryTone: StatSecondaryTone;
  selected?: boolean;
  onClick?: () => void;
}) {
  const displayValue = Math.round(useCountUp(value));

  const inner = (
    <>
      <span className={statNumberClass}>{displayValue}</span>
      <div className="flex w-full min-w-0 items-stretch gap-0.5">
        <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5 text-left text-foreground">
          <span className={statWordClass}>{line1}</span>
          <span className={statWordClass}>{line2}</span>
        </div>
        {onClick ? (
          <ChevronRight
            className="mt-0.5 h-3 w-3 shrink-0 self-start text-muted-foreground/60 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-white"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex w-full min-w-0 items-center gap-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={secondaryLabelClass[secondaryTone]}>{secondaryLabel}</span>
      </div>
    </>
  );

  if (!onClick) {
    return <div className={statCellClass}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        statCellClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        selected && "bg-white/70 ring-1 ring-primary/20"
      )}
    >
      {inner}
    </button>
  );
}

interface AssetsSummaryRowProps {
  assets: AssetViewRow[];
  onFilterClick?: (filter: AssetMetricKey) => void;
  highlightedFilter?: AssetMetricKey;
}

export function AssetsSummaryRow({
  assets,
  onFilterClick,
  highlightedFilter,
}: AssetsSummaryRowProps) {
  const counts = useMemo(() => {
    const active = assets.filter((a) => (a.status || "active") === "active").length;
    const needsInspection = assets.filter(
      (a) => (a.condition_score ?? 100) < 60 && (a.status || "active") === "active"
    ).length;
    const nonCompliant = assets.filter(
      (a) => a.compliance_required && (a.condition_score ?? 100) < 60
    ).length;
    const attention = assets.filter((a) => {
      const isActive = (a.status || "active") === "active";
      if (!isActive) return false;
      return (a.condition_score ?? 100) < 60 || (a.open_tasks_count ?? 0) > 0;
    }).length;
    return { active, needsInspection, nonCompliant, attention };
  }, [assets]);

  return (
    <div className="grid w-full min-w-0 grid-cols-3 items-stretch gap-y-[5px] divide-x divide-border/30">
      <MetricBlock
        value={counts.active}
        line1="active"
        line2="assets"
        secondaryCount={counts.attention}
        secondaryLabel={counts.attention > 0 ? "ATTENTION" : "CLEAR"}
        secondaryTone={counts.attention > 0 ? "warning" : "neutral"}
        selected={highlightedFilter === "active"}
        onClick={onFilterClick ? () => onFilterClick("active") : undefined}
      />
      <MetricBlock
        value={counts.needsInspection}
        line1="need"
        line2="inspection"
        secondaryCount={counts.needsInspection}
        secondaryLabel={counts.needsInspection > 0 ? "POOR" : "OK"}
        secondaryTone={counts.needsInspection > 0 ? "warning" : "neutral"}
        selected={highlightedFilter === "needsInspection"}
        onClick={onFilterClick ? () => onFilterClick("needsInspection") : undefined}
      />
      <MetricBlock
        value={counts.nonCompliant}
        line1="non"
        line2="compliant"
        secondaryCount={counts.nonCompliant}
        secondaryLabel={counts.nonCompliant > 0 ? "ACTION" : "OK"}
        secondaryTone={counts.nonCompliant > 0 ? "urgent" : "neutral"}
        selected={highlightedFilter === "nonCompliant"}
        onClick={onFilterClick ? () => onFilterClick("nonCompliant") : undefined}
      />
    </div>
  );
}
