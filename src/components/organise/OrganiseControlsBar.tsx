import { useMemo, useState } from "react";
import {
  FilterBar,
  type FilterGroup,
  type FilterOption,
} from "@/components/ui/filters/FilterBar";
import { FilterRowSearchField } from "@/components/ui/filters/FilterRowSearchField";
import { SortBar, type SortOption } from "@/components/ui/filters/SortBar";
import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";
import type { FilterFavourite } from "@/lib/filterFavourites";
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
  /** Screen key for the pinned favourites row under FILTER / SORT / SEARCH. */
  favouritesKey?: string;
  defaultFavourites?: FilterFavourite[];
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
  favouritesKey,
  defaultFavourites,
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
          <FilterRowSearchField
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        </>
      }
      favouritesKey={favouritesKey}
      defaultFavourites={defaultFavourites}
      sortOptions={sortOptions}
      sortBy={sortBy}
      onSortChange={(id) => onSortChange(id as WorkbenchSortBy)}
    />
  );
}
