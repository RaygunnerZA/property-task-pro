import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  primaryOptions: FilterOption[];
  secondaryGroups: FilterGroup[];
  selectedFilters: Set<string>;
  onFilterChange: (filterId: string, selected: boolean) => void;
  className?: string;
}

/**
 * FilterBar - Progressive Filter System
 * 
 * Features:
 * - Primary chips always visible (first 3 most used, horizontal row)
 * - "Filter by..." button to expand category groups
 * - Category chips shown in second row when expanded
 * - Third row shows specific options when a category is selected
 * - Neomorphic toggle style: Active = Inset/Darker, Inactive = Lifted/Lighter
 */
export function FilterBar({
  primaryOptions,
  secondaryGroups,
  selectedFilters,
  onFilterChange,
  className,
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Limit primary options to first 3 (most used)
  const mostUsedOptions = primaryOptions.slice(0, 3);

  const handleFilterToggle = (filterId: string) => {
    const isSelected = selectedFilters.has(filterId);
    onFilterChange(filterId, !isSelected);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      // If already selected, deselect and hide third row
      setSelectedCategory(null);
    } else {
      // Select this category and show its options
      setSelectedCategory(categoryId);
    }
  };

  const selectedGroup = selectedCategory 
    ? secondaryGroups.find(g => g.id === selectedCategory)
    : null;

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (selectedCategory || isExpanded) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedCategory, isExpanded]);

  // Render chip with animation
  const renderChip = (
    option: FilterOption,
    index: number,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <button
      key={option.id}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] flex-shrink-0",
        "font-mono text-xs uppercase tracking-wide",
        "select-none cursor-pointer",
        isAnimating && "animate-chip-slide-in",
        isSelected
          ? // Active: Pressed neumorphic with off-white fill
            "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
          : // Inactive: Transparent with neumorphic shadows
            "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
        option.color && isSelected && "text-white"
      )}
      style={{
        ...(isSelected && option.color ? { backgroundColor: option.color } : {}),
        ...(isAnimating ? { animationDelay: `${index * 30}ms` } : {}),
      }}
    >
      {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
      <span>{option.label}</span>
    </button>
  );

  return (
    <div className={cn("space-y-1", className)}>
      {/* Top Row - Primary filters always visible, horizontally scrollable */}
      <div className="flex items-center gap-2 overflow-x-auto min-h-[32px] pb-0.5 no-scrollbar">
        <div className="flex items-center gap-2 flex-nowrap min-w-max">
          {mostUsedOptions.map((option, index) => {
            const isSelected = selectedFilters.has(option.id);
            return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
          })}

          {/* Filter by... Button */}
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
              if (isExpanded) {
                setSelectedCategory(null);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] flex-shrink-0",
              "font-mono text-xs uppercase tracking-wide transition-all",
              "select-none cursor-pointer",
              isExpanded
                ? // Active: Pressed neumorphic with off-white fill
                  "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                : // Inactive: Transparent with neumorphic shadows
                  "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
            )}
          >
            {isExpanded ? (
              <>
                <X className="h-3 w-3" />
                <span>Close</span>
              </>
            ) : (
              <span>Filter by...</span>
            )}
          </button>
        </div>
      </div>

      {/* Category Row - Second Row (shown when Filter by... is expanded) */}
      {isExpanded && (
        <div className="pt-0.5 pb-0.5 transition-all duration-200">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <div className="flex items-center gap-2 flex-nowrap min-w-max">
              {secondaryGroups.map((group, index) => {
                const isCategorySelected = selectedCategory === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => handleCategoryClick(group.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] flex-shrink-0",
                      "font-mono text-xs uppercase tracking-wide",
                      "select-none cursor-pointer",
                      "animate-chip-slide-in",
                      isCategorySelected
                        ? // Active: Pressed neumorphic with off-white fill
                          "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                        : // Inactive: Transparent with neumorphic shadows
                          "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                    }}
                  >
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Third Row - Category Options (shown when a category is selected) */}
      {isExpanded && selectedGroup && (
        <div className="pt-0.5 pb-1 transition-all duration-200">
          {/* Special handling for "Assigned to" - show people on one line, teams on second */}
          {selectedGroup.id === "assigned-to" && selectedGroup.options.length > 0 ? (
            <div className="space-y-0.5">
              {/* People Row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                <div className="flex items-center gap-2 flex-nowrap min-w-max">
                  {selectedGroup.options
                    .filter(opt => opt.id.startsWith("filter-assigned-person-"))
                    .map((option, index) => {
                      const isSelected = selectedFilters.has(option.id);
                      return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
                    })}
                </div>
              </div>
              {/* Teams Row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                <div className="flex items-center gap-2 flex-nowrap min-w-max">
                  {selectedGroup.options
                    .filter(opt => opt.id.startsWith("filter-assigned-team-"))
                    .map((option, index) => {
                      const isSelected = selectedFilters.has(option.id);
                      return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
                    })}
                </div>
              </div>
            </div>
          ) : (
            // Standard row for other categories
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <div className="flex items-center gap-2 flex-nowrap min-w-max">
                {selectedGroup.options.map((option, index) => {
                  const isSelected = selectedFilters.has(option.id);
                  return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

