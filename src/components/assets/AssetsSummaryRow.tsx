/**
 * AssetsSummaryRow — Property Assets context column metrics.
 * Visual grammar aligned with FilterChip / attention tabs: 8px radius, raised shadow,
 * pressed/inset when this metric matches the active list filter.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

type MetricKey = "active" | "needsInspection" | "nonCompliant" | "retired";

type Accent = "teal" | "amber" | "red" | "slate";

const TOP_BAR: Record<Accent, string> = {
  teal: "bg-primary/50",
  amber: "bg-warning/55",
  red: "bg-destructive/40",
  slate: "bg-muted-foreground/40",
};

/** Same raised / inset shadows as `FilterChip` (chips/filter/Chip.tsx) */
const RAISED =
  "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]";
const INSET =
  "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]";

function AssetMetricTile({
  title,
  count,
  accent,
  metricKey,
  highlightedFilter,
  onClick,
}: {
  title: string;
  count: number;
  accent: Accent;
  metricKey: MetricKey;
  highlightedFilter?: MetricKey;
  onClick?: () => void;
}) {
  const selected = highlightedFilter === metricKey;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full min-w-0 text-left rounded-[8px] overflow-hidden border-0 p-0 m-0",
        "font-sans antialiased transition-all duration-150 select-none",
        RAISED,
        "bg-background text-foreground",
        selected ? cn("bg-card", INSET) : "hover:bg-card/80",
        !selected && "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.25)]",
        onClick && "cursor-pointer active:scale-[0.99]",
        !onClick && "cursor-default opacity-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
      )}
    >
      <div className={cn("h-1 w-full shrink-0", TOP_BAR[accent])} aria-hidden />
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1">
        <span className="text-sm font-medium leading-tight text-foreground min-w-0">{title}</span>
        <span
          className={cn(
            "shrink-0 tabular-nums text-2xl font-bold leading-none text-primary",
            "min-w-[2.75rem] text-center rounded-[8px] px-2 py-1",
            INSET,
            "bg-muted/50"
          )}
        >
          {count}
        </span>
      </div>
      {onClick && (
        <div className="px-3 pb-2.5 pt-0 flex justify-end">
          <span className="text-[11px] font-mono uppercase tracking-wide text-primary font-medium">
            View
          </span>
        </div>
      )}
    </button>
  );
}

interface AssetsSummaryRowProps {
  assets: AssetViewRow[];
  onFilterClick?: (filter: MetricKey) => void;
  /** When set, tile uses inset “selected” styling like attention tabs */
  highlightedFilter?: MetricKey;
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
    const retired = assets.filter((a) => a.status === "retired").length;
    return { active, needsInspection, nonCompliant, retired };
  }, [assets]);

  return (
    <div className="flex w-full max-w-[265px] min-w-0 flex-col gap-2.5 px-0">
      <AssetMetricTile
        title="Active Assets"
        count={counts.active}
        accent="teal"
        metricKey="active"
        highlightedFilter={highlightedFilter}
        onClick={onFilterClick ? () => onFilterClick("active") : undefined}
      />
      <AssetMetricTile
        title="Needs Inspection"
        count={counts.needsInspection}
        accent="amber"
        metricKey="needsInspection"
        highlightedFilter={highlightedFilter}
        onClick={onFilterClick ? () => onFilterClick("needsInspection") : undefined}
      />
      <AssetMetricTile
        title="Non-Compliant"
        count={counts.nonCompliant}
        accent="red"
        metricKey="nonCompliant"
        highlightedFilter={highlightedFilter}
        onClick={onFilterClick ? () => onFilterClick("nonCompliant") : undefined}
      />
      <AssetMetricTile
        title="Retired"
        count={counts.retired}
        accent="slate"
        metricKey="retired"
        highlightedFilter={highlightedFilter}
        onClick={onFilterClick ? () => onFilterClick("retired") : undefined}
      />
    </div>
  );
}
