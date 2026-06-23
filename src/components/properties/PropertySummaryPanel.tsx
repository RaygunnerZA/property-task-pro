import { useCallback, useMemo } from "react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";
import { computePropertySummaryMetrics } from "@/lib/propertySummaryMetrics";
import type { PropertySummaryMetrics } from "@/lib/propertySummaryMetrics";
import {
  getAllPropertiesSummaryLines,
  getPropertyAiSummaryLines,
  type PropertyAiSummaryLine,
  type PropertyAiSummaryTarget,
} from "@/lib/propertyAiSummary";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { PropertyForStrip } from "@/components/properties/PropertyIdentityStrip";
import { useSignalsQuery } from "@/hooks/useSignalsQuery";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";

const statNumberClass =
  "self-start pl-1.5 pb-1 text-[32px] font-medium tabular-nums leading-none text-[#5aa3a9] transition-colors group-hover:text-white sm:pb-[3px] sm:text-[24px]";

const statWordClass =
  "font-mono text-[11px] font-semibold uppercase leading-tight tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

const statCellClass =
  "group flex min-w-0 w-full flex-col items-start justify-start self-start rounded-[12px] bg-background/55 px-2 pb-3 pt-3 text-left shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.08),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.7)] transition-all hover:bg-[#3A4A6A] hover:shadow-none sm:px-1.5 sm:pb-3";

type StatSecondaryTone = "urgent" | "warning" | "neutral";

const secondaryCountBoxClass: Record<StatSecondaryTone, string> = {
  urgent:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[8px] bg-white px-1 text-[10px] font-bold tabular-nums leading-none text-destructive",
  warning:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[8px] bg-white px-1 text-[10px] font-bold tabular-nums leading-none text-amber-600",
  neutral:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[8px] bg-white px-1 text-[10px] font-bold tabular-nums leading-none text-muted-foreground",
};

const secondaryLabelClass: Record<StatSecondaryTone, string> = {
  urgent:
    "font-mono text-[9px] font-bold uppercase tracking-[0.04em] text-destructive transition-colors group-hover:text-[#EB6834]",
  warning:
    "font-mono text-[9px] font-bold uppercase tracking-[0.04em] text-amber-600 transition-colors group-hover:text-amber-300",
  neutral:
    "font-mono text-[9px] font-bold uppercase tracking-[0.04em] text-muted-foreground transition-colors group-hover:text-white/90",
};

type PropertySummaryPanelProps = {
  property: PropertyForStrip;
  tasks?: unknown[];
  documents?: PropertyDocument[];
  peopleCount?: number;
  urgentOpenTaskCount?: number;
  loading?: boolean;
  onOpenUrgent?: () => void;
  onOpenTasks?: () => void;
  onOpenCompliance?: () => void;
  onOpenInspections?: () => void;
  onOpenSpaces?: () => void;
  onOpenAssets?: () => void;
  onOpenPeople?: () => void;
  onOpenRecords?: () => void;
  className?: string;
  /** Compact omits radial progress and entity count rows */
  variant?: "full" | "compact";
  /** Precomputed metrics for portfolio / aggregate cards */
  metricsOverride?: PropertySummaryMetrics;
  summaryLinesOverride?: PropertyAiSummaryLine[];
  /** Portfolio card: load org-wide signals for summary lines */
  portfolioSignals?: boolean;
  onSummaryLineActivate?: (target: PropertyAiSummaryTarget) => void;
};

function StatColumn({
  value,
  line1,
  line2,
  secondaryCount,
  secondaryLabel,
  secondaryTone = "neutral",
  onActivate,
}: {
  value: number;
  line1: string;
  line2: string;
  secondaryCount: number;
  secondaryLabel: string;
  secondaryTone?: StatSecondaryTone;
  onActivate?: () => void;
}) {
  const inner = (
    <>
      <span className={statNumberClass}>{value}</span>
      <div className="flex w-full min-w-0 items-stretch gap-0.5">
        <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5 text-left text-foreground">
          <span className={statWordClass}>{line1}</span>
          <span className={statWordClass}>{line2}</span>
        </div>
      </div>
      <div className="mt-1.5 flex w-[77px] items-center gap-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={secondaryLabelClass[secondaryTone]}>{secondaryLabel}</span>
      </div>
    </>
  );

  if (!onActivate) {
    return (
      <div className={statCellClass}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        statCellClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      )}
    >
      {inner}
    </button>
  );
}

function CountRow({
  label,
  count,
  onActivate,
}: {
  label: string;
  count: number;
  onActivate?: () => void;
}) {
  const content = (
    <>
      <span className="text-[14px] font-medium text-muted-foreground">{label}</span>
      <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[8px] bg-white px-1 text-[14px] font-semibold tabular-nums text-muted-foreground shadow-[inset_1px_1px_1px_0px_rgba(0,0,0,0.15)]">
        {count}
      </span>
    </>
  );

  if (!onActivate) {
    return <div className="flex items-center justify-between gap-2 py-1">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex w-full items-center justify-between gap-2 rounded-[12px] py-1 pl-[11px] pr-[3px] text-left text-sm shadow-[1px_2px_1px_0px_rgba(0,0,0,0.1),inset_1px_2px_2px_0px_rgba(255,255,255,1)] transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
    >
      {content}
    </button>
  );
}

function activateSummaryTarget(
  target: PropertyAiSummaryTarget,
  onSummaryLineActivate?: (target: PropertyAiSummaryTarget) => void
) {
  if (onSummaryLineActivate) {
    onSummaryLineActivate(target);
    return;
  }

  if (target.type === "task") {
    window.dispatchEvent(
      new CustomEvent("filla:assistant-open-task", { detail: { taskId: target.taskId } })
    );
    return;
  }

  if (target.type === "signal") {
    const payload: WorkbenchAttentionSelectPayload = {
      kind: "signal",
      snapshot: target.snapshot,
    };
    window.dispatchEvent(
      new CustomEvent("filla:workbench-open-attention", { detail: payload })
    );
    return;
  }

  if (target.type === "filter") {
    window.dispatchEvent(
      new CustomEvent("filla:workbench-apply-filter", { detail: { filterId: target.filterId } })
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent("filla:workbench-open-records", { detail: { documentId: target.documentId } })
  );
}

function SummarySuggestionLine({
  line,
  onActivate,
}: {
  line: PropertyAiSummaryLine;
  onActivate?: (target: PropertyAiSummaryTarget) => void;
}) {
  if (!line.target) {
    return <p>{line.text}</p>;
  }

  return (
    <button
      type="button"
      onClick={() => activateSummaryTarget(line.target!, onActivate)}
      className="block w-full text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 rounded-sm"
    >
      {line.text}
    </button>
  );
}

export function PropertySummaryPanel({
  property,
  tasks = [],
  documents = [],
  peopleCount = 0,
  urgentOpenTaskCount = 0,
  loading = false,
  onOpenUrgent,
  onOpenTasks,
  onOpenCompliance,
  onOpenInspections,
  onOpenSpaces,
  onOpenAssets,
  onOpenPeople,
  onOpenRecords,
  className,
  variant = "full",
  metricsOverride,
  summaryLinesOverride,
  portfolioSignals = false,
  onSummaryLineActivate,
}: PropertySummaryPanelProps) {
  const propertyName = property.nickname || property.address;
  const { data: scopedSignals = [] } = useSignalsQuery({
    propertyIds: portfolioSignals ? undefined : [property.id],
  });

  const metrics = useMemo(
    () =>
      metricsOverride ??
      computePropertySummaryMetrics(
        property,
        tasks as Parameters<typeof computePropertySummaryMetrics>[1],
        documents,
        0,
        urgentOpenTaskCount
      ),
    [property, tasks, documents, urgentOpenTaskCount, metricsOverride]
  );

  const summaryLines = useMemo(() => {
    if (summaryLinesOverride) return summaryLinesOverride;
    if (portfolioSignals && metricsOverride) {
      return getAllPropertiesSummaryLines(
        tasks as Parameters<typeof getAllPropertiesSummaryLines>[0],
        0,
        scopedSignals
      );
    }
    return getPropertyAiSummaryLines(
      tasks as Parameters<typeof getPropertyAiSummaryLines>[0],
      documents,
      scopedSignals,
      propertyName
    );
  }, [
    tasks,
    documents,
    summaryLinesOverride,
    scopedSignals,
    propertyName,
    portfolioSignals,
    metricsOverride,
  ]);

  const handleSummaryLineActivate = useCallback(
    (target: PropertyAiSummaryTarget) => {
      activateSummaryTarget(target, onSummaryLineActivate);
    },
    [onSummaryLineActivate]
  );

  const tasksSecondary = useMemo(() => {
    if (metrics.urgentItems > 0) {
      return { count: metrics.urgentItems, label: "URGENT", tone: "urgent" as const };
    }
    if (metrics.dueSoonTasks > 0) {
      return { count: metrics.dueSoonTasks, label: "DUE SOON", tone: "warning" as const };
    }
    return {
      count: metrics.incompleteTasks,
      label: "INCOMPLETE TASKS",
      tone: "neutral" as const,
    };
  }, [metrics.dueSoonTasks, metrics.incompleteTasks, metrics.urgentItems]);

  const complianceSecondary = useMemo(() => {
    const expired = property.expired_compliance_count ?? 0;
    if (expired > 0) {
      return { count: expired, label: "EXPIRED", tone: "urgent" as const };
    }
    if (metrics.complianceDueSoon > 0) {
      return { count: metrics.complianceDueSoon, label: "DUE SOON", tone: "warning" as const };
    }
    return { count: 0, label: "DUE SOON", tone: "neutral" as const };
  }, [metrics.complianceDueSoon, property.expired_compliance_count]);

  const eventsSecondary = useMemo(() => {
    if (metrics.overdueInspections > 0) {
      return { count: metrics.overdueInspections, label: "OVERDUE", tone: "urgent" as const };
    }
    if (metrics.dueSoonInspections > 0) {
      return { count: metrics.dueSoonInspections, label: "DUE SOON", tone: "warning" as const };
    }
    return { count: 0, label: "SCHEDULED", tone: "neutral" as const };
  }, [metrics.dueSoonInspections, metrics.overdueInspections]);

  if (loading) {
    return <Skeleton className={cn("h-[320px] w-full rounded-xl", className)} />;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full rounded-xl">
        <div className="grid grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px]">
          <StatColumn
            value={metrics.openTasks}
            line1="open"
            line2="tasks"
            secondaryCount={tasksSecondary.count}
            secondaryLabel={tasksSecondary.label}
            secondaryTone={tasksSecondary.tone}
            onActivate={onOpenTasks}
          />
          <StatColumn
            value={metrics.complianceReviews}
            line1="to"
            line2="review"
            secondaryCount={complianceSecondary.count}
            secondaryLabel={complianceSecondary.label}
            secondaryTone={complianceSecondary.tone}
            onActivate={onOpenCompliance}
          />
          <StatColumn
            value={metrics.upcomingInspections}
            line1="upcoming"
            line2="events"
            secondaryCount={eventsSecondary.count}
            secondaryLabel={eventsSecondary.label}
            secondaryTone={eventsSecondary.tone}
            onActivate={onOpenInspections}
          />
        </div>

        {variant === "full" ? (
          <div className="flex items-start gap-0 border-b border-dashed border-border/40 px-1 pb-1 pt-1">
            <div className="flex w-[42%] min-w-[96px] shrink-0 flex-col items-center">
              <RadialProgress
                value={metrics.completionPct}
                size={78}
                thickness={5}
                innerDiscSize={57}
                labelMarginLeft={4}
                embed
                visualWeight="soft"
                aria-label={`${metrics.completedLabel}, ${metrics.completionPct}%`}
              />
              <p className="mt-1 max-w-[96px] text-center text-[10px] font-medium leading-tight text-muted-foreground">
                {metrics.completedLabel}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-[2px] border-l border-dashed border-border/35 pb-[11px] pl-2">
              <CountRow label="Spaces" count={metrics.spacesCount} onActivate={onOpenSpaces} />
              <CountRow label="Assets" count={metrics.assetsCount} onActivate={onOpenAssets} />
              <CountRow label="People" count={peopleCount} onActivate={onOpenPeople} />
              <CountRow label="Records" count={metrics.documentsCount} onActivate={onOpenRecords} />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "grid grid-cols-[auto_1fr] items-start gap-2.5 border-t-2 border-t-white px-3 py-3",
            variant === "compact" &&
              "gap-x-2.5 gap-y-[5px] border-t border-t-border/30 pl-0 pr-1.5 pt-[2px] pb-3"
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-start justify-center rounded-2xl rounded-bl-sm",
              variant === "compact" ? "h-[29px] w-[15px]" : "h-9 w-[21px]"
            )}
            aria-hidden
          >
            <FillaIcon size={24} className="opacity-90" />
          </div>
          <div
            className={cn(
              "min-w-0 space-y-1 text-[14px] leading-snug text-foreground/85",
              variant === "compact" && "w-[208px] text-[12px] tracking-[-0.4px]"
            )}
          >
            {summaryLines.map((line, index) => (
              <SummarySuggestionLine
                key={`${line.text}-${index}`}
                line={line}
                onActivate={handleSummaryLineActivate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
