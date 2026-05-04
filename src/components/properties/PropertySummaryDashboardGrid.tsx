import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadialProgress } from "@/components/ui/radial-progress";

const neuTileCoreClass =
  "rounded-[12px] shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.04),inset_-2px_-2px_3px_0px_rgba(255,255,255,0.45)] transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const neuTileMutedBgClass = "bg-background/55";

const neuTileBorderClass = "border border-border/25";

const neuTileClass = cn(neuTileCoreClass, neuTileMutedBgClass, neuTileBorderClass);

const bigNumberClass =
  "text-[32px] font-normal tabular-nums leading-none text-[rgba(22,115,110,0.88)]";

/** Open tasks headline digit — calmer than debossed teal. */
const openTasksCountClass =
  "inline-block text-[32px] font-normal tabular-nums leading-none text-[rgba(22,115,110,0.88)]";

const subNumberPillClass =
  "flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1 shadow-none";

/** Urgent count chip — same dimensions in every tile. */
const urgentChipClass =
  "inline-flex h-[18px] min-w-[20px] shrink-0 items-center justify-center rounded-[5px] border border-destructive/25 bg-destructive/12 px-1 text-[11px] font-semibold tabular-nums leading-none text-destructive shadow-none";

const urgentIssuesRowClass =
  "flex w-full shrink-0 items-center justify-center gap-1.5";

/** Two-line label — tight leading so the chip centers cleanly beside it. */
const urgentIssuesLabelClass =
  "inline-block min-w-0 max-w-[3.25rem] text-center text-[9px] font-medium leading-tight text-muted-foreground";

function UrgentIssuesFooter({ count, onActivate }: { count: number; onActivate?: () => void }) {
  if (count <= 0) {
    return (
      <span className="w-full max-w-[4.5rem] text-center text-[9px] leading-tight text-muted-foreground/70">
        No urgent issues
      </span>
    );
  }
  if (onActivate) {
    return (
      <button
        type="button"
        className={cn(
          urgentIssuesRowClass,
          "cursor-pointer rounded-md outline-none transition-colors",
          "hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onActivate();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        aria-label="View urgent issues"
      >
        <span className={urgentChipClass}>{count}</span>
        <span className={urgentIssuesLabelClass}>
          Urgent
          <br />
          issues
        </span>
      </button>
    );
  }
  return (
    <div className={urgentIssuesRowClass}>
      <span className={urgentChipClass}>{count}</span>
      <span className={urgentIssuesLabelClass}>
        Urgent
        <br />
        issues
      </span>
    </div>
  );
}

function DashedRule({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-0 w-full shrink-0 border-t border-dashed border-border/45",
        className
      )}
      aria-hidden
    />
  );
}

export type PropertySummaryDashboardGridProps = {
  openTasksCount: number;
  urgentOpenTaskCount: number;
  completionPct: number;
  completedLabel: string;
  onOpenTasks: () => void;
  /** Lists urgent/high-priority open tasks (Issues → Open + urgent filter). */
  onOpenUrgentTasks?: () => void;
  onAddTask?: () => void;

  spacesCount: number;
  spaceUrgentIssuesCount: number;
  onOpenSpaces: () => void;
  /** Lists spaces tied to urgent/high tasks. */
  onOpenUrgentSpaces?: () => void;

  assetsCount: number;
  assetsUrgentIssuesCount: number;
  onOpenAssets: () => void;
  /** Lists assets with poor condition or open tasks (same metric as the tile). */
  onOpenAttentionAssets?: () => void;

  documentsCountLabel: string;
  docDueSoon: number;
  docExpiring: number;
  docMissing: number;
  onOpenDocuments: () => void;
};

export function PropertySummaryDashboardGrid({
  openTasksCount,
  urgentOpenTaskCount,
  completionPct,
  completedLabel,
  onOpenTasks,
  onOpenUrgentTasks,
  onAddTask,
  spacesCount,
  spaceUrgentIssuesCount,
  onOpenSpaces,
  onOpenUrgentSpaces,
  assetsCount,
  assetsUrgentIssuesCount,
  onOpenAssets,
  onOpenAttentionAssets,
  documentsCountLabel,
  docDueSoon,
  docExpiring,
  docMissing,
  onOpenDocuments,
}: PropertySummaryDashboardGridProps) {
  return (
    <div className="grid h-full min-h-0 w-full grid-cols-3 grid-rows-2 gap-x-0 gap-y-1.5 px-1.5 pb-1.5 pt-0.5">
      {/* Tasks — 1×2 */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          neuTileClass,
          "relative row-span-2 flex h-[243px] min-h-0 min-w-0 w-[80px] flex-col items-center justify-start gap-0 bg-white/75 px-1 pb-[6px] pt-[9px] shadow-none",
          onAddTask && "max-md:pb-7"
        )}
        onClick={onOpenTasks}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenTasks();
          }
        }}
      >
        {onAddTask && (
          <button
            type="button"
            aria-label="Report Issue"
            className="absolute bottom-1 left-1/2 z-10 flex h-6 w-[79px] -translate-x-1/2 items-center justify-center align-bottom rounded-lg font-semibold text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        )}
        <span className={cn(openTasksCountClass, "mt-0.5")}>{openTasksCount}</span>
        <span className="mb-1 mt-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.2px] text-muted-foreground">
          OPEN TASKS
        </span>
        <DashedRule className="my-0 max-w-[72px] py-1" />
        <div className="flex h-[99px] w-[84px] min-h-0 shrink-0 flex-col items-center justify-center gap-1 px-0">
          <RadialProgress
            value={completionPct}
            size={72}
            thickness={5}
            innerDiscSize={54}
            labelMarginLeft={6}
            embed
            visualWeight="soft"
            aria-label={`${completedLabel}, ${completionPct}%`}
          />
          <span className="max-w-[88px] pb-1 text-center font-sans text-[10px] font-medium tabular-nums leading-tight tracking-[0.1px] text-muted-foreground">
            {completedLabel}
          </span>
        </div>
        <DashedRule className="my-0 max-w-[72px] py-1" />
        <div className="mt-1.5 flex w-full justify-center px-0.5">
          <UrgentIssuesFooter count={urgentOpenTaskCount} onActivate={onOpenUrgentTasks} />
        </div>
      </div>

      {/* Spaces — 1×1 */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          neuTileClass,
          "flex h-full min-h-0 min-w-0 flex-col items-center justify-start px-1 pb-1.5 pt-3"
        )}
        onClick={onOpenSpaces}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenSpaces();
          }
        }}
      >
        <span className={bigNumberClass}>{spacesCount}</span>
        <span className="mt-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
          SPACES
        </span>
        <div className="mt-auto flex w-full flex-col items-center px-0.5 pt-1">
          <UrgentIssuesFooter count={spaceUrgentIssuesCount} onActivate={onOpenUrgentSpaces} />
        </div>
      </div>

      {/* Assets — 1×1 (no tile border; matches preview) */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          neuTileCoreClass,
          neuTileMutedBgClass,
          "flex h-full min-h-0 min-w-0 flex-col items-center justify-start px-1 pb-1.5 pt-3"
        )}
        onClick={onOpenAssets}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenAssets();
          }
        }}
      >
        <span className={bigNumberClass}>{assetsCount}</span>
        <span className="mt-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
          ASSETS
        </span>
        <div className="mt-auto flex w-full flex-col items-center px-0.5 pt-1">
          <UrgentIssuesFooter count={assetsUrgentIssuesCount} onActivate={onOpenAttentionAssets} />
        </div>
      </div>

      {/* Documents — 1×2 (span bottom row); no filled tile bg */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          neuTileCoreClass,
          neuTileBorderClass,
          "col-span-2 col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col px-0 pb-[9px] pt-[11px]"
        )}
        onClick={onOpenDocuments}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDocuments();
          }
        }}
      >
        <div className="flex h-[27px] min-h-[27px] items-baseline justify-center gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums text-foreground/75">
            [{documentsCountLabel}]
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
            DOCUMENTS
          </span>
        </div>
        <DashedRule className="my-0" />
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-0">
          <div className={subNumberPillClass}>
            <span className="text-[26px] font-light tabular-nums text-amber-700/75">
              {docDueSoon}
            </span>
            <span className="text-center font-mono text-[9px] font-medium uppercase leading-tight tracking-normal text-muted-foreground">
              DUE SOON
            </span>
          </div>
          <div className="flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 py-1 shadow-none">
            <span className="text-[26px] font-light tabular-nums text-orange-800/70">
              {docExpiring}
            </span>
            <span className="text-center font-mono text-[9px] font-medium uppercase leading-tight tracking-normal text-muted-foreground">
              EXPIRING
            </span>
          </div>
          <div
            className={cn(
              "flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-t-none rounded-b-[12px] px-1 py-1 shadow-none"
            )}
          >
            <span className="text-[26px] font-light tabular-nums text-primary/80">
              {docMissing}
            </span>
            <span className="text-center font-mono text-[9px] font-medium uppercase leading-tight tracking-normal text-muted-foreground">
              MISSING
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
