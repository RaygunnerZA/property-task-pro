import type { RecordGroupDef } from "@/lib/records/recordGroups";
import { getRecordGroupCardIllustration } from "@/lib/records/recordGroupIllustrations";
import { cn } from "@/lib/utils";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

type RecordGroupCardProps = {
  group: RecordGroupDef;
  count: number;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
};

/**
 * Your Cabinet group card — illustration sits on transparent paper (no light panel);
 * title block keeps the original card fill + shadow-e1.
 */
export function RecordGroupCard({
  group,
  count,
  selected = false,
  onSelect,
  className,
}: RecordGroupCardProps) {
  const countLabel = count === 1 ? "1 record" : `${count} records`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex h-[295px] w-[230px] shrink-0 flex-col bg-transparent text-left",
        "transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected && "ring-2 ring-primary/50",
        className
      )}
    >
      {/* No card fill here — page paper texture shows through behind the art */}
      <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
        <img
          src={getRecordGroupCardIllustration(group.id)}
          alt=""
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <span className="sr-only">{group.label}</span>
      </div>

      {/* Original card face under the image — flat top so it meets the art without a radius lip */}
      <div className="flex min-h-0 flex-1 flex-col space-y-3 rounded-b-card bg-card px-3 pb-3 pt-0.5 shadow-e1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            {group.label}
          </h3>
          <span
            className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wider text-white"
            style={{ backgroundColor: group.color }}
          >
            {count}
          </span>
        </div>
        <div className="-mx-1 pt-0.5" style={DASHED_LINE_STYLE} aria-hidden />
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {group.description}
        </p>
        <p className="mt-auto text-2xs font-mono uppercase tracking-wider text-muted-foreground">
          {countLabel}
        </p>
      </div>
    </button>
  );
}
