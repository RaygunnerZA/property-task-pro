import { FilterChip } from "@/components/chips/filter";
import { AUTO_ARCHIVE_INTERVALS, type AutoArchiveIntervalId } from "@/lib/autoArchive";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import { cn } from "@/lib/utils";

const SOFT_BLUE = "hsl(205 42% 88%)";

type AutoArchiveCardProps = {
  intervalId: AutoArchiveIntervalId | null;
  onSelectInterval: (id: AutoArchiveIntervalId) => void;
  onRestoreClick: () => void;
  className?: string;
};

export function AutoArchiveCard({
  intervalId,
  onSelectInterval,
  onRestoreClick,
  className,
}: AutoArchiveCardProps) {
  return (
    <section
      aria-label="Auto Archive"
      className={cn(
        "relative overflow-hidden rounded-[14px] px-4 py-4 shadow-sm sm:px-5 sm:py-5",
        className
      )}
      style={paperTexturedColorStyle(SOFT_BLUE)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="mx-auto flex h-[120px] w-[100px] shrink-0 items-center justify-center sm:mx-0 sm:h-[132px] sm:w-[112px]">
          <img
            src="/tasks/auto-archive.png"
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Auto Archive
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Automatically archive completed tasks after
            </p>
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start"
            role="group"
            aria-label="Archive after"
          >
            {AUTO_ARCHIVE_INTERVALS.map((interval) => (
              <FilterChip
                key={interval.id}
                label={interval.label}
                selected={intervalId === interval.id}
                onSelect={() => onSelectInterval(interval.id)}
                className="h-[24px] normal-case"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onRestoreClick}
            className="text-[11px] text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-sm"
          >
            Restore a Task
          </button>
        </div>
      </div>
    </section>
  );
}
