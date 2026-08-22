import { FilterChip } from "@/components/chips/filter";
import { AUTO_ARCHIVE_INTERVALS, type AutoArchiveIntervalId } from "@/lib/autoArchive";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import { cn } from "@/lib/utils";

/** Darker turquoise-leaning blue (near brand teal, quieter). */
const SOFT_BLUE = "hsl(188 40% 58%)";
/** Cream on blue for title / body / restore link. */
const CREAM = "text-[#F7F3EB]";
const CREAM_MUTED = "text-[#F7F3EB]/80";

type AutoArchiveCardProps = {
  intervalId: AutoArchiveIntervalId | null;
  onSelectInterval: (id: AutoArchiveIntervalId) => void;
  onRestoreClick: () => void;
  className?: string;
  /**
   * `inline` — last cell beside horizontal workbench cards.
   * `tile` — last cell beside tall vertical task cards.
   */
  layout?: "inline" | "tile";
};

export function AutoArchiveCard({
  intervalId,
  onSelectInterval,
  onRestoreClick,
  className,
  layout = "inline",
}: AutoArchiveCardProps) {
  const isTile = layout === "tile";

  return (
    <section
      aria-label="Auto Archive"
      className={cn(
        "relative overflow-hidden rounded-card shadow-e1",
        isTile
          ? "flex h-full min-h-[240px] w-full flex-col px-3 pb-3 pt-3"
          : "flex h-[108px] max-h-[108px] w-full flex-row items-center gap-3 px-3 py-2.5",
        className
      )}
      style={paperTexturedColorStyle(SOFT_BLUE)}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center",
          isTile ? "mx-auto h-[100px] w-[88px]" : "h-[88px] w-[72px]"
        )}
      >
        <img
          src="/tasks/auto-archive.png"
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 space-y-2",
          isTile ? "text-center" : "text-left"
        )}
      >
        <div>
          <div
            className={cn(
              "flex items-baseline gap-2",
              isTile ? "justify-center" : "justify-between gap-3"
            )}
          >
            <h3
              className={cn(
                "min-w-0 text-sm font-semibold tracking-tight sm:text-base",
                CREAM
              )}
            >
              Auto Archive
            </h3>
            <button
              type="button"
              onClick={onRestoreClick}
              className={cn(
                "shrink-0 text-[11px] underline-offset-2",
                CREAM_MUTED,
                "hover:text-[#F7F3EB] hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm"
              )}
            >
              Restore a Task
            </button>
          </div>
          <p className={cn("mt-0.5 text-xs leading-snug", CREAM_MUTED)}>
            Archive completed tasks after
          </p>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            isTile ? "justify-center" : "justify-start"
          )}
          role="group"
          aria-label="Archive after"
        >
          {AUTO_ARCHIVE_INTERVALS.map((interval) => (
            <FilterChip
              key={interval.id}
              label={interval.label}
              selected={intervalId === interval.id}
              onSelect={() => onSelectInterval(interval.id)}
              className="h-[24px]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
