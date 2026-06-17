import { useMemo } from "react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";
import { computePropertySummaryMetrics } from "@/lib/propertySummaryMetrics";
import { getPropertyAiSummaryLines } from "@/lib/propertyAiSummary";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { PropertyForStrip } from "@/components/properties/PropertyIdentityStrip";

const statNumberClass =
  "pb-[3px] text-[31px] font-normal tabular-nums leading-none text-teal-600";

const statWordClass =
  "font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.15px] text-muted-foreground";

type PropertySummaryPanelProps = {
  property: PropertyForStrip;
  tasks?: unknown[];
  documents?: PropertyDocument[];
  messagesCount?: number;
  urgentOpenTaskCount?: number;
  loading?: boolean;
  onOpenUrgent?: () => void;
  onOpenTasks?: () => void;
  onOpenCompliance?: () => void;
  onOpenInspections?: () => void;
  onOpenMessages?: () => void;
  onOpenSpaces?: () => void;
  onOpenAssets?: () => void;
  onOpenDocuments?: () => void;
  className?: string;
};

function StatColumn({
  value,
  line1,
  line2,
  onActivate,
}: {
  value: number;
  line1: string;
  line2: string;
  onActivate?: () => void;
}) {
  const inner = (
    <>
      <span className={statNumberClass}>{value}</span>
      <span className={statWordClass}>{line1}</span>
      <span className={statWordClass}>{line2}</span>
    </>
  );

  if (!onActivate) {
    return (
      <div className="flex min-w-0 flex-col items-center px-0.5 pb-2 pt-4 text-center">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex min-w-0 flex-col items-center rounded-[10px] px-0.5 pb-2 pt-4 text-center transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-muted/50 px-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
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
      className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
    >
      {content}
    </button>
  );
}

export function PropertySummaryPanel({
  property,
  tasks = [],
  documents = [],
  messagesCount = 0,
  urgentOpenTaskCount = 0,
  loading = false,
  onOpenUrgent,
  onOpenTasks,
  onOpenCompliance,
  onOpenInspections,
  onOpenMessages,
  onOpenSpaces,
  onOpenAssets,
  onOpenDocuments,
  className,
}: PropertySummaryPanelProps) {
  const metrics = useMemo(
    () =>
      computePropertySummaryMetrics(
        property,
        tasks as Parameters<typeof computePropertySummaryMetrics>[1],
        documents,
        messagesCount,
        urgentOpenTaskCount
      ),
    [property, tasks, documents, messagesCount, urgentOpenTaskCount]
  );

  const summaryLines = useMemo(
    () => getPropertyAiSummaryLines(tasks as Parameters<typeof getPropertyAiSummaryLines>[0], documents),
    [tasks, documents]
  );

  if (loading) {
    return <Skeleton className={cn("h-[320px] w-full rounded-xl", className)} />;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full rounded-xl">
        <div className="grid grid-cols-4 border-b border-border/30">
          <StatColumn
            value={metrics.openTasks}
            line1="open"
            line2="tasks"
            onActivate={onOpenTasks}
          />
          <StatColumn
            value={metrics.complianceReviews}
            line1="compliance"
            line2="reviews"
            onActivate={onOpenCompliance}
          />
          <StatColumn
            value={metrics.urgentItems}
            line1="urgent"
            line2="items"
            onActivate={onOpenUrgent}
          />
          <StatColumn
            value={metrics.upcomingInspections}
            line1="upcoming"
            line2="inspection"
            onActivate={onOpenInspections}
          />
        </div>

        <div className="flex items-start gap-0 border-b border-dashed border-border/40 px-1 pb-2 pt-1">
          <div className="flex w-[42%] min-w-[96px] shrink-0 flex-col items-center">
            <RadialProgress
              value={metrics.completionPct}
              size={68}
              thickness={5}
              innerDiscSize={50}
              labelMarginLeft={4}
              embed
              visualWeight="soft"
              aria-label={`${metrics.completedLabel}, ${metrics.completionPct}%`}
            />
            <p className="mt-1 max-w-[96px] text-center text-[10px] font-medium leading-tight text-muted-foreground">
              {metrics.completedLabel}
            </p>
          </div>

          <div className="min-w-0 flex-1 border-l border-dashed border-border/35 pl-2 pr-1 pt-2">
            <CountRow label="Messages" count={metrics.messagesCount} onActivate={onOpenMessages} />
            <CountRow label="Spaces" count={metrics.spacesCount} onActivate={onOpenSpaces} />
            <CountRow label="Assets" count={metrics.assetsCount} onActivate={onOpenAssets} />
            <CountRow label="Documents" count={metrics.documentsCount} onActivate={onOpenDocuments} />
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-start gap-2.5 px-3 py-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl rounded-bl-sm bg-primary/15 shadow-sm"
            aria-hidden
          >
            <FillaIcon size={20} className="opacity-90" />
          </div>
          <div className="min-w-0 space-y-1 text-[11px] leading-snug text-foreground/85">
            {summaryLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
