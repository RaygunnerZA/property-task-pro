import { cn } from "@/lib/utils";
import type { ReportKpis } from "@/lib/reports/types";

const KPI_META = [
  { key: "needsAttention" as const, label: "Needs attention", seed: "attention" },
  { key: "completed" as const, label: "Completed", seed: "completed" },
  { key: "overdue" as const, label: "Overdue", seed: "overdue" },
  { key: "upcoming" as const, label: "Upcoming", seed: "upcoming" },
];

type Props = {
  kpis: ReportKpis;
  previousKpis?: ReportKpis;
  onSelect?: (seed: "attention" | "completed" | "overdue" | "upcoming") => void;
  className?: string;
};

export function ReportKpiRow({ kpis, previousKpis, onSelect, className }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {KPI_META.map(({ key, label, seed }) => {
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
            <div className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
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
