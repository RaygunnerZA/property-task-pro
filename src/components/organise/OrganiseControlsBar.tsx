import { useState } from "react";
import { Search } from "lucide-react";
import {
  FilterBar,
  type FilterGroup,
  type FilterOption,
} from "@/components/ui/filters/FilterBar";
import { SortBar, type SortOption } from "@/components/ui/filters/SortBar";
import { Input } from "@/components/ui/input";
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
 * Standard organise controls row — [FILTER] [SORT] [SEARCH______] — shared by
 * Spaces · Assets · Records. Same FilterBar / SortBar chrome as Tasks and
 * Calendar (@Docs/04_UI_System.md — organise views).
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

  return (
    <FilterBar
      primaryOptions={primaryOptions}
      secondaryGroups={secondaryGroups}
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
          <div className="relative min-w-[150px] max-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-0 bg-background/80 pl-8 text-sm shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
              aria-label={searchPlaceholder}
            />
          </div>
        </>
      }
    />
  );
}
