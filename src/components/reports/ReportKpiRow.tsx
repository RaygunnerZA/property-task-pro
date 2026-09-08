import { cn } from "@/lib/utils";
import type { ReportKpis } from "@/lib/reports/types";

const KPI_META = [
  {
    key: "needsAttention" as const,
    label: "Attention",
    seed: "attention" as const,
    color: "rgba(255, 184, 77, 1)",
  },
  {
    key: "completed" as const,
    label: "Done",
    seed: "completed" as const,
    color: "rgba(16, 185, 129, 1)",
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

type Props = {
  kpis: ReportKpis;
  previousKpis?: ReportKpis;
  onSelect?: (seed: "attention" | "completed" | "overdue" | "upcoming") => void;
  className?: string;
  /** Match Records Property Health — inset neomorphic cells, one row. */
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
        <div className="grid grid-cols-4 gap-1">
          {KPI_META.map(({ key, label, seed, color }) => {
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
                  "flex min-w-0 flex-col items-center justify-center rounded-xl bg-transparent px-0.5 py-1.5 text-center",
                  "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]",
                  interactive &&
                    "transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                )}
              >
                <p
                  className="inline-block bg-paper bg-paper-texture bg-clip-text text-[18px] font-medium leading-none tabular-nums text-shadow-neu"
                  style={{ color, fontFamily: '"Inter Tight"' }}
                >
                  {value}
                </p>
                <p className="mt-0.5 max-w-full truncate text-2xs leading-tight text-muted-foreground">
                  {label}
                </p>
                {delta !== null ? (
                  <p
                    className={cn(
                      "mt-0.5 text-2xs tabular-nums",
                      delta > 0 ? "text-[#EB6834]" : "text-muted-foreground"
                    )}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </p>
                ) : null}
              </Comp>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-3", className)}>
      {KPI_META.map(({ key, label, seed, color }) => {
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
              className="text-3xl font-semibold tracking-tight tabular-nums"
              style={{ color, fontFamily: '"Inter Tight"' }}
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
