import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronUp } from "lucide-react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
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
import {
  CENTRE_WORKBENCH_TAB_META,
  centreWorkbenchTasksPath,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";

const statNumberClass =
  "self-start pl-1.5 pb-1 text-[32px] font-medium tabular-nums leading-none text-primary-deep transition-colors group-hover:text-white sm:pb-[3px] sm:text-2xl";

const statNumberInlineClass =
  "shrink-0 text-[28px] font-medium tabular-nums leading-none text-primary-deep transition-colors group-hover:text-white";

const statWordClass =
  "font-mono text-caption font-semibold uppercase leading-tight tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

const statCellClass =
  "group flex min-w-0 w-full flex-col items-start justify-start self-start rounded-xl bg-background/55 px-2 pb-3 pt-3 text-left shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.08),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-ink hover:shadow-none active:scale-[0.98] sm:px-1.5 sm:pb-3";

/** Staggered section reveal on mount — fade + 2px rise, honours reduced motion. */
const sectionRevealClass = "motion-safe:animate-fade-slide-in";
const sectionRevealStyle = (index: number): CSSProperties => ({
  animationDelay: `${index * 60}ms`,
  animationFillMode: "both",
});

/** Home left-rail metrics: auto-collapse after idle so the strip settles. On desktop the three stat blocks collapse with the snapshot. */
const METRICS_AUTO_COLLAPSE_MS = 2 * 60 * 1000;
const metricsCollapseMotionClass =
  "grid transition-[grid-template-rows] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const metricsChevronMotionClass =
  "h-4 w-4 transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const STAT_CENTRE_TABS: readonly CentreWorkbenchTab[] = ["inflow", "tasks", "calendar"];

type StatSecondaryTone = "urgent" | "warning" | "neutral";

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
  /** Active Inflow · Tasks · Calendar tab (highlights phone summary entry cells). */
  centreWorkbenchTab?: CentreWorkbenchTab;
  onCentreWorkbenchTabChange?: (tab: CentreWorkbenchTab) => void;
  /**
   * Home-hub phone: show summary stats as entry to Inflow · Tasks · Calendar.
   * Compact carousel cards also show this entry UI on phone regardless.
   */
  showCentreNavBelowPhone?: boolean;
  routeCentreNavToWorkSurface?: boolean;
};

type StatCentreNav = {
  tab: CentreWorkbenchTab;
  isActive?: boolean;
};

function StatColumn({
  value,
  line1,
  line2,
  secondaryCount,
  secondaryLabel,
  secondaryTone = "neutral",
  onActivate,
  centreNav,
}: {
  value: number;
  line1: string;
  line2: string;
  secondaryCount: number;
  secondaryLabel: string;
  secondaryTone?: StatSecondaryTone;
  onActivate?: () => void;
  /**
   * Phone home: metric cell doubles as entry to a work screen
   * (to review → Inflow, open tasks → Tasks, upcoming events → Calendar).
   */
  centreNav?: StatCentreNav;
}) {
  const centreMeta = centreNav ? CENTRE_WORKBENCH_TAB_META[centreNav.tab] : null;
  const displayValue = Math.round(useCountUp(value));

  const inner = centreMeta ? (
    <>
      <div className="mb-1.5 flex w-full min-w-0 flex-col items-start gap-0.5">
        <img
          src={centreMeta.illustrationSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            "h-[42px] w-[42px] shrink-0 object-contain drop-shadow-sm transition-opacity",
            centreNav?.isActive ? "opacity-100" : "opacity-85 group-hover:opacity-100"
          )}
        />
        <span
          className={cn(
            "min-w-0 text-left text-2xs font-semibold uppercase tracking-[0.08em] transition-colors",
            centreNav?.isActive
              ? "text-primary group-hover:text-white"
              : "text-muted-foreground group-hover:text-white/90"
          )}
        >
          {centreMeta.label}
        </span>
      </div>
      <div className="flex w-full min-w-0 items-start gap-1">
        <span className={statNumberInlineClass}>{displayValue}</span>
        <div className="flex min-w-0 flex-1 flex-col items-start pt-0.5 text-left text-foreground">
          <span className={statWordClass}>{line1}</span>
          <span className={statWordClass}>{line2}</span>
        </div>
      </div>
      <div className="mt-1.5 flex w-full min-w-0 items-center gap-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={secondaryLabelClass[secondaryTone]}>{secondaryLabel}</span>
      </div>
    </>
  ) : (
    <>
      <span className={statNumberClass}>{displayValue}</span>
      <div className="flex w-full min-w-0 items-stretch gap-0.5">
        <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5 text-left text-foreground">
          <span className={statWordClass}>{line1}</span>
          <span className={statWordClass}>{line2}</span>
        </div>
        {onActivate ? (
          <ChevronRight
            className="mt-0.5 h-3 w-3 shrink-0 self-start text-muted-foreground/60 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-white"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex w-[77px] items-center gap-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={secondaryLabelClass[secondaryTone]}>{secondaryLabel}</span>
      </div>
    </>
  );

  if (!onActivate) {
    return <div className={statCellClass}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-current={centreNav?.isActive ? "true" : undefined}
      className={cn(
        statCellClass,
        centreNav?.isActive && "bg-white/70 ring-1 ring-primary/20",
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
  const displayCount = Math.round(useCountUp(count));

  const content = (interactive: boolean) => (
    <>
      <span
        className={cn(
          "text-sm font-medium text-muted-foreground",
          interactive && "transition-colors duration-150 group-hover/row:text-foreground"
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-0.5">
        {interactive ? (
          <ChevronRight
            className="h-3 w-3 -translate-x-1 text-muted-foreground/60 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/row:translate-x-0 group-hover/row:opacity-100"
            aria-hidden
          />
        ) : null}
        <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-card bg-white px-1 text-sm font-semibold tabular-nums text-muted-foreground shadow-[inset_1px_1px_1px_0px_rgba(0,0,0,0.15)]">
          {displayCount}
        </span>
      </span>
    </>
  );

  if (!onActivate) {
    return (
      <div className="ml-auto flex w-full max-w-[118px] items-center justify-between gap-2 py-1">
        {content(false)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "group/row ml-auto flex w-full max-w-[118px] items-center justify-between gap-2 rounded-xl py-1 pl-2.5 pr-[3px] text-left text-sm",
        "bg-transparent shadow-none",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out",
        "hover:bg-muted/30 hover:shadow-[1px_2px_1px_0px_rgba(0,0,0,0.1),inset_1px_2px_2px_0px_rgba(255,255,255,1)]",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        "focus-visible:bg-muted/30 focus-visible:shadow-[1px_2px_1px_0px_rgba(0,0,0,0.1),inset_1px_2px_2px_0px_rgba(255,255,255,1)]"
      )}
    >
      {content(true)}
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
      className="block w-full rounded-sm text-left underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline hover:decoration-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
  centreWorkbenchTab,
  onCentreWorkbenchTabChange,
  showCentreNavBelowPhone = false,
  routeCentreNavToWorkSurface = false,
}: PropertySummaryPanelProps) {
  /**
   * Compact property cards on phone always expose Inflow · Tasks · Calendar entry
   * (same as the all-properties card). Home-hub also opts in via showCentreNavBelowPhone.
   */
  const showPhoneWorkEntries = showCentreNavBelowPhone || variant === "compact";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const metricsAutoCollapsedRef = useRef(false);
  const propertyName = property.nickname || property.address;

  useEffect(() => {
    if (variant !== "full" || metricsAutoCollapsedRef.current) return;

    const timeoutId = window.setTimeout(() => {
      metricsAutoCollapsedRef.current = true;
      setMetricsExpanded(false);
    }, METRICS_AUTO_COLLAPSE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [variant]);
  const { data: scopedSignals = [] } = useSignalsQuery({
    propertyIds: portfolioSignals ? undefined : [property.id],
  });

  const openCentreTab = useCallback(
    (tab: CentreWorkbenchTab) => {
      const params =
        typeof window === "undefined"
          ? new URLSearchParams(searchParams)
          : new URLSearchParams(window.location.search);

      if (portfolioSignals) {
        params.delete("property");
      } else if (property.id) {
        params.set("property", property.id);
      }

      if (routeCentreNavToWorkSurface || showPhoneWorkEntries) {
        navigate(centreWorkbenchTasksPath(tab, params));
        return;
      }
      if (onCentreWorkbenchTabChange) {
        onCentreWorkbenchTabChange(tab);
        return;
      }
      navigate(centreWorkbenchTasksPath(tab, params));
    },
    [
      navigate,
      searchParams,
      portfolioSignals,
      property.id,
      routeCentreNavToWorkSurface,
      showPhoneWorkEntries,
      onCentreWorkbenchTabChange,
    ]
  );

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

  const desktopStats = [
    {
      value: metrics.complianceReviews,
      line1: "to",
      line2: "review",
      secondary: complianceSecondary,
      onActivate: onOpenCompliance,
      centreTab: STAT_CENTRE_TABS[0],
    },
    {
      value: metrics.openTasks,
      line1: "open",
      line2: "tasks",
      secondary: tasksSecondary,
      onActivate: onOpenTasks,
      centreTab: STAT_CENTRE_TABS[1],
    },
    {
      value: metrics.upcomingInspections,
      line1: "upcoming",
      line2: "events",
      secondary: eventsSecondary,
      onActivate: onOpenInspections,
      centreTab: STAT_CENTRE_TABS[2],
    },
  ] as const;

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full rounded-xl">
        {/* Phone: Inflow · Tasks · Calendar entry (icons + metrics) */}
        {showPhoneWorkEntries ? (
          <div
            className={cn(
              "grid grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px] md:hidden",
              sectionRevealClass
            )}
            style={sectionRevealStyle(0)}
            role="navigation"
            aria-label="Open Inflow, Tasks, or Calendar"
          >
            {desktopStats.map((stat) => (
              <StatColumn
                key={stat.centreTab}
                value={stat.value}
                line1={stat.line1}
                line2={stat.line2}
                secondaryCount={stat.secondary.count}
                secondaryLabel={stat.secondary.label}
                secondaryTone={stat.secondary.tone}
                centreNav={{
                  tab: stat.centreTab,
                  isActive: centreWorkbenchTab === stat.centreTab,
                }}
                onActivate={() => openCentreTab(stat.centreTab)}
              />
            ))}
          </div>
        ) : null}

        {/* Phone (no work-entry nav): keep the three metric blocks visible while desktop collapses. */}
        {!showPhoneWorkEntries ? (
          <div
            className={cn(
              "grid grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px] md:hidden",
              sectionRevealClass
            )}
            style={sectionRevealStyle(0)}
          >
            {desktopStats.map((stat) => (
              <StatColumn
                key={stat.centreTab}
                value={stat.value}
                line1={stat.line1}
                line2={stat.line2}
                secondaryCount={stat.secondary.count}
                secondaryLabel={stat.secondary.label}
                secondaryTone={stat.secondary.tone}
                onActivate={stat.onActivate}
              />
            ))}
          </div>
        ) : null}

        {variant === "full" ? (
          <div className={cn(sectionRevealClass)} style={sectionRevealStyle(1)}>
            <div
              className={cn(
                metricsCollapseMotionClass,
                metricsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                {/* Desktop: three metric blocks collapse with the snapshot below. */}
                <div className="hidden grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px] md:grid">
                  {desktopStats.map((stat) => (
                    <StatColumn
                      key={stat.centreTab}
                      value={stat.value}
                      line1={stat.line1}
                      line2={stat.line2}
                      secondaryCount={stat.secondary.count}
                      secondaryLabel={stat.secondary.label}
                      secondaryTone={stat.secondary.tone}
                      onActivate={stat.onActivate}
                    />
                  ))}
                </div>
                <div className="flex items-start gap-1 border-b border-dashed border-border/40 px-1 pb-2 pt-[7px]">
                  <div className="flex w-[52%] min-w-[118px] shrink-0 flex-col items-center justify-center">
                    <RadialProgress
                      value={metrics.completionPct}
                      size={100}
                      thickness={7}
                      innerDiscSize={74}
                      labelMarginLeft={6}
                      embed
                      visualWeight="soft"
                      aria-label={`${metrics.completedLabel}, ${metrics.completionPct}%`}
                    />
                    <p className="mt-1.5 max-w-[112px] text-center text-2xs font-medium leading-tight text-muted-foreground">
                      {metrics.completedLabel}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-stretch justify-center gap-0.5 border-l border-dashed border-border/35 py-1 pl-1.5 pr-0.5">
                    <CountRow label="Spaces" count={metrics.spacesCount} onActivate={onOpenSpaces} />
                    <CountRow label="Assets" count={metrics.assetsCount} onActivate={onOpenAssets} />
                    <CountRow label="People" count={peopleCount} onActivate={onOpenPeople} />
                    <CountRow label="Records" count={metrics.documentsCount} onActivate={onOpenRecords} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center pb-[10px] pt-0.5">
              <button
                type="button"
                onClick={() => setMetricsExpanded((open) => !open)}
                aria-expanded={metricsExpanded}
                aria-label={
                  metricsExpanded ? "Collapse property metrics" : "Expand property metrics"
                }
                className="flex w-full items-center justify-center rounded-lg py-0.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <ChevronUp
                  className={cn(
                    metricsChevronMotionClass,
                    !metricsExpanded && "rotate-180"
                  )}
                  strokeWidth={2.2}
                />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "hidden grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px] md:grid",
              sectionRevealClass
            )}
            style={sectionRevealStyle(0)}
          >
            {desktopStats.map((stat) => (
              <StatColumn
                key={stat.centreTab}
                value={stat.value}
                line1={stat.line1}
                line2={stat.line2}
                secondaryCount={stat.secondary.count}
                secondaryLabel={stat.secondary.label}
                secondaryTone={stat.secondary.tone}
                onActivate={stat.onActivate}
              />
            ))}
          </div>
        )}

          <div
            className={cn(
              "grid grid-cols-[auto_1fr] items-start gap-2.5 border-t-2 border-t-white px-3 py-3",
              variant === "compact" &&
                "gap-x-2.5 gap-y-[5px] border-t border-t-border/30 pl-0 pr-1.5 pt-[2px] pb-3",
              sectionRevealClass
            )}
            style={sectionRevealStyle(2)}
            aria-label="Filla suggestion"
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
              "min-w-0 space-y-1 text-sm leading-snug text-foreground/85",
              variant === "compact" && "w-[208px] text-xs tracking-[-0.4px]"
            )}
          >
            <p className="font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested
            </p>
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
