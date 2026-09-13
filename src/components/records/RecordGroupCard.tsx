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
 * Description expands on hover/focus only (no selected outline).
 * Height is content-sized so the parent slider can flex with the expand.
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
        "group flex w-[230px] shrink-0 flex-col self-start bg-transparent text-left",
        "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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

      {/* Content-sized face — no flex-1 stretch into the old 310px carousel void */}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-b-card bg-card px-3 pb-2.5 pt-0.5 shadow-e1",
          "transition-shadow duration-200",
          selected && "shadow-md"
        )}
      >
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
        <div className="-mx-1" style={DASHED_LINE_STYLE} aria-hidden />
        <p className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
          {countLabel}
        </p>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
            "grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="pb-0.5 pt-0.5 text-xs leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
