import { cn } from "@/lib/utils";
import { getRecordGroupCardIllustration } from "@/lib/records/recordGroupIllustrations";
import { getRecordGroup, type RecordGroupId } from "@/lib/records/recordGroups";
import type { ExplorerCategoryId } from "@/lib/records/explorerFilters";
import { EXPLORER_CATEGORY_ORDER } from "@/lib/records/explorerFilters";
import { LayoutGrid } from "lucide-react";

type CategoryCount = { total: number; attention: number };

type RecordsCategoryRailProps = {
  active: ExplorerCategoryId;
  onSelect: (id: ExplorerCategoryId) => void;
  counts: Record<string, CategoryCount>;
  className?: string;
};

function categoryLabel(id: ExplorerCategoryId): string {
  if (id === "all") return "All records";
  if (id === "Misc") return "Miscellaneous";
  return getRecordGroup(id as RecordGroupId)?.label ?? id;
}

export function RecordsCategoryRail({
  active,
  onSelect,
  counts,
  className,
}: RecordsCategoryRailProps) {
  return (
    <nav
      className={cn("flex h-full min-h-0 flex-col", className)}
      aria-label="Document categories"
    >
      <p className="mb-2 px-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
        Categories
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {EXPLORER_CATEGORY_ORDER.map((id) => {
          const isActive = active === id;
          const count = counts[id]?.total ?? 0;
          const attention = counts[id]?.attention ?? 0;
          const Icon = id === "all" ? LayoutGrid : getRecordGroup(id as RecordGroupId)?.icon;
          const thumb =
            id === "all" ? null : getRecordGroupCardIllustration(id as RecordGroupId);

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-left transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "bg-primary/15 shadow-[inset_0_0_0_1.5px_rgba(142,201,206,0.85)]"
                    : "hover:bg-card/80"
                )}
              >
                <span
                  className={cn(
                    "relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-card shadow-e1",
                    isActive && "ring-1 ring-primary/50"
                  )}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      decoding="async"
                    />
                  ) : Icon ? (
                    <span className="flex h-full w-full items-center justify-center bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {categoryLabel(id)}
                  </span>
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    {count}
                    {attention > 0 ? (
                      <span className="ml-1.5 text-destructive">· {attention}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
