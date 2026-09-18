import { useMemo, useState } from "react";
import {
  FilterBar,
  type FilterGroup,
  type FilterOption,
} from "@/components/ui/filters/FilterBar";
import { SortBar, type SortOption } from "@/components/ui/filters/SortBar";
import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";
import { cn } from "@/lib/utils";

export const ORGANISE_SORT_OPTIONS: SortOption[] = [
  { id: "title", label: "A-Z" },
  { id: "recent", label: "Newest" },
  { id: "priority", label: "Attention" },
];

type OrganiseControlsBarProps = {
  primaryOptions: FilterOption[];
  secondaryGroups?: FilterGroup[];
  selectedFilters: Set<string>;
  onFilterChange: (filterId: string, selected: boolean) => void;
  sortBy: WorkbenchSortBy;
  onSortChange: (sort: WorkbenchSortBy) => void;
  sortOptions?: SortOption[];
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
};

/**
 * Standard organise controls row — [FILTER] [SORT] [SEARCH______] only.
 * Quick filters live under FILTER → categories (no primary chips in the row).
 * Search is a pressed neo input sharing the filter-chip mono style.
 */
export function OrganiseControlsBar({
  primaryOptions,
  secondaryGroups = [],
  selectedFilters,
  onFilterChange,
  sortBy,
  onSortChange,
  sortOptions = ORGANISE_SORT_OPTIONS,
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  className,
}: OrganiseControlsBarProps) {
  const [filterExpanded, setFilterExpanded] = useState(false);

  const mergedSecondaryGroups = useMemo(() => {
    const groups: FilterGroup[] = [];
    if (primaryOptions.length > 0) {
      groups.push({
        id: "organise-quick",
        label: "Quick",
        options: primaryOptions,
      });
    }
    groups.push(...secondaryGroups);
    return groups;
  }, [primaryOptions, secondaryGroups]);

  return (
    <FilterBar
      primaryOptions={[]}
      secondaryGroups={mergedSecondaryGroups}
      selectedFilters={selectedFilters}
      onFilterChange={onFilterChange}
      className={cn(className)}
      collapseFilterChipAfterMs={2000}
      onExpandedChange={setFilterExpanded}
      afterFilterTrigger={
        <>
          <SortBar
            sortBy={sortBy}
            onSortChange={onSortChange}
            options={sortOptions}
            forceCollapsed={filterExpanded}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={cn(
              "h-[28px] min-w-[120px] max-w-[220px] flex-1 rounded-[8px] px-2.5",
              "font-mono text-2xs uppercase tracking-wide leading-none text-foreground",
              "placeholder:text-muted-foreground",
              "bg-background",
              "shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.55)]",
              "outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            )}
          />
        </>
      }
    />
  );
}
