import { useMemo } from "react";
import { Triangle } from "lucide-react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { computeHubSummaryMetrics } from "@/lib/hubSummaryMetrics";
import { cn } from "@/lib/utils";

const statNumberClass =
  "text-[32px] font-normal tabular-nums leading-none text-teal-600";

const statLabelClass =
  "mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.2px] text-muted-foreground";

const statTileInteractiveClass =
  "cursor-pointer transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25";

const statTileClass =
  "flex min-w-0 flex-col items-center rounded-[12px] bg-transparent px-2 pb-2.5 pt-5 text-center shadow-none";

type HubSummaryPanelProps = {
  tasks?: unknown[];
  properties?: {
    id: string;
    open_tasks_count?: number | null;
    spaces_count?: number | null;
    assets_count?: number | null;
  }[];
  selectedPropertyIds?: Set<string>;
  loading?: boolean;
  onOpenTasks?: () => void;
  onOpenUrgentTasks?: () => void;
  onOpenSpaces?: () => void;
  onOpenAssets?: () => void;
  onDueSoon?: () => void;
  onOverdue?: () => void;
  onMissingInfo?: () => void;
  className?: string;
};

function StatusRow({
  label,
  count,
  tone = "default",
  onActivate,
}: {
  label: string;
  count: number;
  tone?: "default" | "danger";
  onActivate?: () => void;
}) {
  const row = (
    <>
      <span
        className={cn(
          "text-[13px] font-medium",
          tone === "danger" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-card px-1.5 text-xs font-semibold tabular-nums",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-muted-foreground"
        )}
      >
        {count}
      </span>
    </>
  );

  if (!onActivate) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">{row}</div>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-md py-1.5 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      onClick={onActivate}
    >
      {row}
    </button>
  );
}

export function HubSummaryPanel({
  tasks = [],
  properties = [],
  selectedPropertyIds = new Set(),
  loading = false,
  onOpenTasks,
  onOpenUrgentTasks,
  onOpenSpaces,
  onOpenAssets,
  onDueSoon,
  onOverdue,
  onMissingInfo,
  className,
}: HubSummaryPanelProps) {
  const metrics = useMemo(
    () =>
      computeHubSummaryMetrics(
        tasks as Parameters<typeof computeHubSummaryMetrics>[0],
        properties,
        selectedPropertyIds
      ),
    [tasks, properties, selectedPropertyIds]
  );

  if (loading) {
    return (
      <div className={cn("w-full max-w-full", className)}>
        <Skeleton className="h-[244px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-full", className)}>
      <div className="h-[244px] w-full rounded-xl border border-border/40 bg-card/60 shadow-e1">
        {/* Top stats row */}
        <div className="grid grid-cols-3 pt-0">
          <div
            role={onOpenTasks ? "button" : undefined}
            tabIndex={onOpenTasks ? 0 : undefined}
            className={cn(statTileClass, onOpenTasks && statTileInteractiveClass)}
            onClick={onOpenTasks}
            onKeyDown={
              onOpenTasks
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenTasks();
                    }
                  }
                : undefined
            }
          >
            <span className={statNumberClass}>{metrics.openTasksCount}</span>
            <span className={statLabelClass}>Open tasks</span>
            {metrics.urgentCount > 0 ? (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-destructive transition-opacity hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUrgentTasks?.();
                }}
              >
                <Triangle className="h-2.5 w-2.5 fill-current" aria-hidden />
                {metrics.urgentCount} Urgent
              </button>
            ) : (
              <span className="mt-1.5 text-[11px] text-muted-foreground/60">No urgent</span>
            )}
          </div>

          <button
            type="button"
            className={cn(statTileClass, statTileInteractiveClass)}
            onClick={onOpenSpaces}
          >
            <span className={statNumberClass}>{metrics.spacesCount}</span>
            <span className={statLabelClass}>Spaces</span>
          </button>

          <button
            type="button"
            className={cn(statTileClass, statTileInteractiveClass)}
            onClick={onOpenAssets}
          >
            <span className={statNumberClass}>{metrics.assetsCount}</span>
            <span className={statLabelClass}>Assets</span>
          </button>
        </div>

        {/* Progress + status list */}
        <div className="flex items-center gap-0 border-t border-dashed border-border/40 pt-0.5 pr-[7px]">
          <div className="flex w-[42%] min-w-[120px] shrink-0 flex-col items-center">
            <RadialProgress
              value={metrics.completionPct}
              size={72}
              thickness={5}
              innerDiscSize={54}
              labelMarginLeft={6}
              embed
              visualWeight="soft"
              aria-label={`${metrics.completedLabel}, ${metrics.completionPct}%`}
            />
            <p className="mt-1 max-w-[120px] text-center text-[11px] font-medium leading-tight text-muted-foreground">
              {metrics.completedLabel}
            </p>
          </div>

          <div className="min-w-0 flex-1 border-l border-dashed border-border/35 pl-1 pr-[3px] pt-[14px]">
            <StatusRow label="Due soon" count={metrics.dueSoonCount} onActivate={onDueSoon} />
            <StatusRow
              label="Overdue"
              count={metrics.overdueCount}
              tone="danger"
              onActivate={onOverdue}
            />
            <StatusRow
              label="Missing info"
              count={metrics.missingInfoCount}
              onActivate={onMissingInfo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
