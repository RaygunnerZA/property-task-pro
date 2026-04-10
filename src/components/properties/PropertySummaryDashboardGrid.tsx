import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadialProgress } from "@/components/ui/radial-progress";

const neuTileClass =
  "rounded-[12px] bg-background/40 shadow-[inset_2.3px_4px_4px_0px_rgba(0,0,0,0.11),inset_-4px_-4px_4px_0px_rgba(255,255,255,0.4)] transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const bigNumberClass =
  "text-[38px] font-medium tabular-nums leading-none text-shadow-neu-pressed text-[rgb(13,148,136)]";

/** Open tasks headline digit: debossed typography on the glyph only (not a padded “tile”). */
const openTasksCountClass =
  "inline-block text-[38px] font-medium tabular-nums leading-none text-[rgba(14,131,136,1)] text-shadow-neu-pressed";

const subNumberPillClass =
  "flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1 shadow-none";

/** Urgent count chip in Spaces / Assets tiles (browser-tuned sizing + coral-red fill). */
const spaceAssetUrgentCountClass =
  "grid h-[18px] min-h-[18px] w-[20px] min-w-[20px] place-items-center rounded-[5px] bg-[rgb(255,107,107)] px-0 py-[2px] text-center text-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06)] -mt-[6px]";

function DashedRule({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-0 w-full shrink-0 border-t-2 border-dashed border-t-[rgba(195,194,193,0.4)]",
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
  onAddTask?: () => void;

  spacesCount: number;
  spaceUrgentIssuesCount: number;
  onOpenSpaces: () => void;

  assetsCount: number;
  assetsUrgentIssuesCount: number;
  onOpenAssets: () => void;

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
  onAddTask,
  spacesCount,
  spaceUrgentIssuesCount,
  onOpenSpaces,
  assetsCount,
  assetsUrgentIssuesCount,
  onOpenAssets,
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
            className="absolute bottom-1 left-1/2 z-10 flex h-6 w-[79px] -translate-x-1/2 items-center justify-center align-bottom rounded-lg font-semibold text-muted-foreground transition-colors hover:bg-[rgb(255,107,107)] hover:text-white md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        )}
        <span className={cn(openTasksCountClass, "mt-0.5")}>{openTasksCount}</span>
        <span className="mb-1 mt-1 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2px] text-muted-foreground">
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
            aria-label={`${completedLabel}, ${completionPct}%`}
          />
          <span className="max-w-[88px] pb-1 text-center font-sans text-[10px] font-medium tabular-nums leading-tight tracking-[0.1px] text-muted-foreground">
            {completedLabel}
          </span>
        </div>
        <DashedRule className="my-0 max-w-[72px] py-1" />
        <div className="flex w-[71px] items-center gap-1 text-[10px] font-medium tabular-nums text-[#EB6834]">
          <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[#EB6834] px-1.5 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
            {urgentOpenTaskCount}
          </span>
          <span className="text-center leading-tight text-muted-foreground">Urgent</span>
        </div>
      </div>

      {/* Spaces — 1×1 */}
      <div
        role="button"
        tabIndex={0}
        className={cn(neuTileClass, "flex min-h-0 min-w-0 flex-col items-center justify-start px-1 pb-1.5 pt-3")}
        onClick={onOpenSpaces}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenSpaces();
          }
        }}
      >
        <span className={bigNumberClass}>{spacesCount}</span>
        <span className="mt-1 pb-[15px] text-center font-mono text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          SPACES
        </span>
        {spaceUrgentIssuesCount > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium tabular-nums text-[#EB6834]">
            <span className={spaceAssetUrgentCountClass}>{spaceUrgentIssuesCount}</span>
            <span className="text-center text-[10px] leading-tight text-muted-foreground">Urgent issues</span>
          </div>
        ) : (
          <span className="mt-1.5 text-[9px] text-muted-foreground/70">No urgent issues</span>
        )}
      </div>

      {/* Assets — 1×1 */}
      <div
        role="button"
        tabIndex={0}
        className={cn(neuTileClass, "flex min-h-0 min-w-0 flex-col items-center justify-start px-1 pb-1.5 pt-3")}
        onClick={onOpenAssets}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenAssets();
          }
        }}
      >
        <span className={bigNumberClass}>{assetsCount}</span>
        <span className="mt-1 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          ASSETS
        </span>
        {assetsUrgentIssuesCount > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium tabular-nums text-[#EB6834]">
            <span className={spaceAssetUrgentCountClass}>{assetsUrgentIssuesCount}</span>
            <span className="text-center text-[10px] leading-tight text-muted-foreground">Urgent issues</span>
          </div>
        ) : (
          <span className="mt-1.5 text-[9px] text-muted-foreground/70">No urgent issues</span>
        )}
      </div>

      {/* Documents — 1×2 (span bottom row) */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          neuTileClass,
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
          <span className="text-[11px] font-semibold tabular-nums text-[rgb(42,41,62)] text-shadow-neu-pressed">
            [{documentsCountLabel}]
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
            DOCUMENTS
          </span>
        </div>
        <DashedRule className="my-0" />
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-0">
          <div className={subNumberPillClass}>
            <span className="text-[28px] font-light tabular-nums text-amber-600 text-shadow-neu-pressed">
              {docDueSoon}
            </span>
            <span className="text-center font-mono text-[9px] font-semibold uppercase leading-tight tracking-normal text-muted-foreground">
              DUE SOON
            </span>
          </div>
          <div className="flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 py-1 shadow-none">
            <span className="text-[28px] font-light tabular-nums text-[#EB6834] text-shadow-neu-pressed">
              {docExpiring}
            </span>
            <span className="text-center font-mono text-[9px] font-semibold uppercase leading-tight tracking-normal text-muted-foreground">
              EXPIRING
            </span>
          </div>
          <div
            className={cn(
              "flex h-[72px] min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-t-none rounded-b-[12px] px-1 py-1 shadow-none"
            )}
          >
            <span className="text-[28px] font-light tabular-nums text-primary text-shadow-neu-pressed">
              {docMissing}
            </span>
            <span className="text-center font-mono text-[9px] font-semibold uppercase leading-tight tracking-normal text-muted-foreground">
              MISSING
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
