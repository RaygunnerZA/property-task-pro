import { cn } from "@/lib/utils";
import {
  explorerCategoryDescription,
  explorerCategoryLabel,
  type ExplorerCategoryId,
} from "@/lib/records/explorerFilters";
import { getRecordGroupCardIllustration } from "@/lib/records/recordGroupIllustrations";
import { getRecordGroup, type RecordGroupId } from "@/lib/records/recordGroups";
import { CENTRE_WORKBENCH_TAB_META } from "@/lib/centreWorkbenchTabs";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

const ALL_RECORDS_ILLUSTRATION = CENTRE_WORKBENCH_TAB_META.records.illustrationSrc;

type RecordsExplorerCategoryCardProps = {
  categoryId: ExplorerCategoryId;
  count: number;
  attentionCount?: number;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
};

function categoryColor(id: ExplorerCategoryId): string {
  if (id === "all") return "#C4A35A";
  return getRecordGroup(id as RecordGroupId)?.color ?? "#8EC9CE";
}

function categoryImage(id: ExplorerCategoryId): string {
  if (id === "all") return ALL_RECORDS_ILLUSTRATION;
  return getRecordGroupCardIllustration(id as RecordGroupId);
}

/**
 * Compact paper-cut category card for the Records explorer carousel
 * (~30–35% smaller than the original cabinet cards).
 */
export function RecordsExplorerCategoryCard({
  categoryId,
  count,
  attentionCount = 0,
  selected = false,
  onSelect,
  className,
}: RecordsExplorerCategoryCardProps) {
  const label = explorerCategoryLabel(categoryId);
  const description = explorerCategoryDescription(categoryId);
  const color = categoryColor(categoryId);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-[min(42vw,200px)] shrink-0 flex-col self-start bg-transparent text-left sm:w-[200px]",
        "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
    >
      <div className="relative h-[112px] w-full shrink-0 overflow-hidden rounded-t-[10px]">
        <img
          src={categoryImage(categoryId)}
          alt=""
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <span className="sr-only">{label}</span>
      </div>

      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-b-[10px] bg-card px-2.5 pb-2 pt-1 shadow-e1",
          "transition-shadow duration-200",
          selected &&
            "shadow-md ring-1 ring-primary/70 ring-offset-1 ring-offset-[hsl(var(--background))]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-foreground">{label}</h3>
          <span
            className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-white"
            style={{ backgroundColor: color }}
          >
            {count}
          </span>
        </div>
        <div className="-mx-0.5" style={DASHED_LINE_STYLE} aria-hidden />
        {attentionCount > 0 && !selected ? (
          <p className="font-mono text-2xs uppercase tracking-wide text-destructive">
            {attentionCount} need attention
          </p>
        ) : (
          <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {count === 1 ? "1 document" : `${count} documents`}
          </p>
        )}
        {selected ? (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
}
