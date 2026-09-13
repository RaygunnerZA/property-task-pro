import { cn } from "@/lib/utils";
import type { ReportKpis } from "@/lib/reports/types";
import { WorkspaceHealthGrid } from "@/components/property-workspace/WorkspaceHealthGrid";

const KPI_META = [
  {
    key: "needsAttention" as const,
    label: "Attention",
    seed: "attention" as const,
    color: "rgba(255, 184, 77, 1)",
  },
  {
    key: "overdue" as const,
    label: "Overdue",
    seed: "overdue" as const,
    color: "rgba(235, 104, 52, 1)",
  },
  {
    key: "upcoming" as const,
    label: "Upcoming",
    seed: "upcoming" as const,
    color: "rgba(142, 201, 206, 1)",
  },
];

/** Full four-metric set for the larger card variant only. */
const KPI_META_CARDS = [
  ...KPI_META.slice(0, 1),
  {
    key: "completed" as const,
    label: "Done",
    seed: "completed" as const,
    color: "rgba(16, 185, 129, 1)",
  },
  ...KPI_META.slice(1),
];

type Props = {
  kpis: ReportKpis;
  previousKpis?: ReportKpis;
  onSelect?: (seed: "attention" | "completed" | "overdue" | "upcoming") => void;
  className?: string;
  /** Match workspace Property Health — inset neomorphic cells, one row of three. */
  variant?: "cards" | "health";
};

export function ReportKpiRow({
  kpis,
  previousKpis,
  onSelect,
  className,
  variant = "health",
}: Props) {
  if (variant === "health") {
    return (
      <div className={cn("space-y-2", className)}>
        <WorkspaceHealthGrid
          ariaLabel="Property health"
          dense
          stats={KPI_META.map(({ key, label, seed, color }) => {
            const value = kpis[key];
            return {
              label,
              value,
              color,
              onClick: onSelect ? () => onSelect(seed) : undefined,
            };
          })}
        />
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {KPI_META_CARDS.map(({ key, label, seed, color }) => {
        const value = kpis[key];
        const prev = previousKpis?.[key];
        const delta =
          prev !== undefined && prev !== value ? value - prev : null;
        const interactive = Boolean(onSelect);
        const Comp = interactive ? "button" : "div";
        return (
          <Comp
            key={key}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onSelect?.(seed) : undefined}
            className={cn(
              "rounded-xl bg-card/70 p-4 text-left shadow-e1 transition-all duration-200",
              interactive &&
                "hover:-translate-y-0.5 hover:shadow-e2 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            )}
          >
            <div
              className="font-display text-3xl font-semibold tracking-tight tabular-nums text-shadow-neu-pressed"
              style={{ color }}
            >
              {value}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            {delta !== null && (
              <div
                className={cn(
                  "mt-1 text-xs tabular-nums",
                  delta > 0 ? "text-[#EB6834]" : "text-muted-foreground"
                )}
              >
                {delta > 0 ? `+${delta}` : delta} vs prior
              </div>
            )}
          </Comp>
        );
      })}
    </div>
  );
}
