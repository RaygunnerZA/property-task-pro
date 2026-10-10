import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type RefObject } from "react";
import { ArrowLeftToLine, Building2, Home, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/chips/filter";
import { IconButton } from "@/components/ui/IconButton";
import {
  FilterFavouritesRow,
  RemoveFavouriteSlot,
  type FavouriteChipView,
} from "@/components/ui/filters/FilterFavouritesRow";
import {
  FavouriteDragProvider,
  HoldToDrag,
} from "@/components/ui/filters/filterFavouriteDrag";
import { useStoredFavourites } from "@/components/ui/filters/useStoredFavourites";
import {
  insertFavourite,
  removeFavourite,
  type FilterFavourite,
} from "@/lib/filterFavourites";
import { TASK_STATUS_ORDER, TASK_STATUS_VISUALS } from "@/lib/taskStatus";

// Custom Funnel icon component (not available in lucide-react)
const Funnel = ({ className, style, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide lucide-funnel", className)}
    style={{ marginLeft: 0, marginRight: 0, ...style }}
    {...props}
  >
    <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>
  </svg>
);

// Custom FunnelX icon component (not available in lucide-react)
const FunnelX = ({ className, style, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide lucide-funnel-x", className)}
    style={style}
    {...props}
  >
    <path d="M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473"/>
    <path d="m16.5 3.5 5 5"/>
    <path d="m21.5 3.5-5 5"/>
  </svg>
);

export interface FilterOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

/** Favourite-row icon tints. Urgent and overdue use the option colour (coral). */
const FAVOURITE_ICON_COLORS: Record<string, string> = {
  "filter-priority-high": "#E8A04A",
};

function favouriteIconColor(option: FilterOption): string | undefined {
  return FAVOURITE_ICON_COLORS[option.id] ?? option.color;
}

function tintIcon(icon: React.ReactNode, color: string): React.ReactNode {
  if (!React.isValidElement(icon)) return icon;
  const element = icon as React.ReactElement<{ style?: React.CSSProperties }>;
  return React.cloneElement(element, {
    style: { ...element.props.style, color },
  });
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
  rightElement?: React.ReactNode; // Optional element to render on the right side of the row (desktop only)
  /** Extra controls after primary chips (e.g. Search chip). */
  primaryTrailing?: React.ReactNode;
  /** Control placed immediately after the FILTER trigger (e.g. SORT). */
  afterFilterTrigger?: React.ReactNode;
  /** Max primary chips after FILTER (default 3). Use 0 for all primaryOptions. */
  primaryOptionLimit?: number;
  /** Prefixes: filters starting with these are not removed by the clear (FunnelX) action. */
  clearPreservePrefixes?: string[];
  /** When set, FunnelX / clear buttons invoke this instead of clearing individual filter ids. */
  onClearAll?: () => void;
  /** When set, controls visibility of clear (FunnelX); overrides derived clearable state. */
  showClearButton?: boolean;
  /**
   * After this many milliseconds from a pointer down inside `collapseInteractionRootRef`,
   * the FILTER control collapses to icon-only (smooth width transition; sibling chips move left).
   */
  collapseFilterChipAfterMs?: number;
  collapseInteractionRootRef?: RefObject<HTMLElement | null>;
  /** Hide the leading “FILTER” funnel control (e.g. parent toolbar already has a filter affordance). */
  hideFilterByButton?: boolean;
  /** Initial row: `categories` opens on Property / Type / Expiry groups without showing primary. */
  defaultNavigationLevel?: "primary" | "categories";
  /** When `hideFilterByButton` and user backs out of the category row, invoke instead of returning to primary. */
  onExitCategoriesLevel?: () => void;
  /** Fires when the bar leaves/returns to the primary (collapsed) level. */
  onExpandedChange?: (expanded: boolean) => void;
  /** When true, force the bar back to the primary level (e.g. peer Sort expands). */
  forceCollapsed?: boolean;
  /** Persists the favourites row for this screen. Omit to keep a single chip row. */
  favouritesKey?: string;
  defaultFavourites?: FilterFavourite[];
  /** Sort chips that can be pinned. Clicking a pinned sort calls `onSortChange`. */
  sortOptions?: { id: string; label: string }[];
  sortBy?: string;
  onSortChange?: (id: string) => void;
  /** Contextual chips ahead of pinned favourites (for example message authors). */
  favouritesLeading?: React.ReactNode;
}

type NavigationLevel = 'primary' | 'categories' | 'options';

export type FilterRowSortSession = {
  options: { id: string; label: string }[];
  sortBy: string;
  onSortChange: (id: string) => void;
};

type FilterRowSortApi = {
  openSort: (session: FilterRowSortSession) => void;
};

const FilterRowSortContext = React.createContext<FilterRowSortApi | null>(null);

/** Sort trigger inside a FilterBar row uses this to replace the row, matching FILTER. */
export function useFilterRowSort() {
  return React.useContext(FilterRowSortContext);
}

/**
 * FilterBar - Single-Row Progressive Filter System
 * 
 * Features:
 * - Single row that replaces content with wipe animations
 * - Level 1: Primary filters (Due, Urgent, My Tasks) + "Filter By" button
 * - Level 2: Category chips (Status, Date Due, Priority, etc.) + Back button
 * - Level 3: Category options + Back button
 * - Right-to-left wipe when entering categories from primary
 * - Left-to-right wipe when entering options from categories
 * - Horizontal scrolling on narrow screens to keep everything on one row
 * - Neomorphic toggle style: Active = Inset/Darker, Inactive = Lifted/Lighter
 */
// Property icon mapping
const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

export function FilterBar({
  primaryOptions,
  secondaryGroups,
  selectedFilters,
  onFilterChange,
  className,
  rightElement,
  primaryTrailing,
  afterFilterTrigger,
  primaryOptionLimit = 3,
  clearPreservePrefixes = ['filter-property-'],
  onClearAll,
  showClearButton,
  collapseFilterChipAfterMs,
  collapseInteractionRootRef,
  hideFilterByButton = false,
  defaultNavigationLevel = "primary",
  onExitCategoriesLevel,
  onExpandedChange,
  forceCollapsed = false,
  favouritesKey,
  defaultFavourites = [],
  sortOptions = [],
  sortBy,
  onSortChange,
  favouritesLeading,
}: FilterBarProps) {
  const [navigationLevel, setNavigationLevel] = useState<NavigationLevel>(() =>
    defaultNavigationLevel === "categories" ? "categories" : "primary"
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'right-to-left' | 'left-to-right' | null>(null);
  const [filterChipCollapsed, setFilterChipCollapsed] = useState(false);
  const [sortSession, setSortSession] = useState<FilterRowSortSession | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;

  useEffect(() => {
    if (!forceCollapsed) return;
    if (navigationLevel === "primary") return;
    setAnimationDirection("right-to-left");
    setNavigationLevel("primary");
    setSelectedCategory(null);
  }, [forceCollapsed, navigationLevel]);

  useEffect(() => {
    onExpandedChangeRef.current?.(navigationLevel !== "primary");
  }, [navigationLevel]);

  const mostUsedOptions =
    primaryOptionLimit <= 0
      ? primaryOptions
      : primaryOptions.slice(0, primaryOptionLimit);

  const selectedGroup = selectedCategory 
    ? secondaryGroups.find(g => g.id === selectedCategory)
    : null;

  const handleFilterToggle = (filterId: string) => {
    const isSelected = selectedFilters.has(filterId);
    onFilterChange(filterId, !isSelected);
  };

  const openSort = useCallback((session: FilterRowSortSession) => {
    setAnimationDirection("left-to-right");
    setSortSession(session);
  }, []);

  const closeSort = useCallback(() => {
    setAnimationDirection("right-to-left");
    setSortSession(null);
  }, []);

  const sortRowApi = useMemo(() => ({ openSort }), [openSort]);
  const [favourites, setFavourites] = useStoredFavourites(favouritesKey, defaultFavourites);

  const handleFavouriteDrop = useCallback(
    (
      item: FilterFavourite,
      source: "menu" | "favourite",
      hit: { overRow: boolean; overRemove: boolean; insertIndex: number }
    ) => {
      setFavourites((current) => {
        if (hit.overRemove && source === "favourite") return removeFavourite(current, item);
        if (hit.overRow) return insertFavourite(current, item, hit.insertIndex);
        return current;
      });
    },
    [setFavourites]
  );

  const handleSortSelect = (id: string) => {
    if (!sortSession) return;
    sortSession.onSortChange(id);
    setSortSession({ ...sortSession, sortBy: id });
  };

  const handleFilterByClick = () => {
    setSortSession(null);
    setAnimationDirection('left-to-right');
    setNavigationLevel('categories');
    setSelectedCategory(null);
  };

  const handleCategoryClick = (categoryId: string) => {
    setAnimationDirection('left-to-right');
    setSelectedCategory(categoryId);
    setNavigationLevel('options');
  };

  const handleBackClick = () => {
    if (navigationLevel === 'options') {
      // Go back from options to categories
      setAnimationDirection('right-to-left');
      setNavigationLevel('categories');
      setSelectedCategory(null);
    } else if (navigationLevel === 'categories') {
      if (hideFilterByButton && onExitCategoriesLevel) {
        onExitCategoriesLevel();
        return;
      }
      // Go back from categories to primary
      setAnimationDirection('right-to-left');
      setNavigationLevel('primary');
      setSelectedCategory(null);
    }
  };

  const handleClearAllFilters = () => {
    if (onClearAll) {
      onClearAll();
      return;
    }
    selectedFilters.forEach((filterId) => {
      const preserve = clearPreservePrefixes.some((p) => filterId.startsWith(p));
      if (!preserve) {
        onFilterChange(filterId, false);
      }
    });
  };

  const hasClearableFilters =
    showClearButton !== undefined
      ? showClearButton
      : Array.from(selectedFilters).some(
          (filterId) => !clearPreservePrefixes.some((p) => filterId.startsWith(p))
        );

  // Reset animation direction after animation completes
  useEffect(() => {
    if (animationDirection) {
      const timer = setTimeout(() => setAnimationDirection(null), 300);
      return () => clearTimeout(timer);
    }
  }, [animationDirection, navigationLevel, selectedCategory]);

  useLayoutEffect(() => {
    const ms = collapseFilterChipAfterMs;
    const rootRef = collapseInteractionRootRef;
    if (ms === undefined || ms <= 0 || !rootRef) return;

    const clearTimer = () => {
      if (collapseTimerRef.current !== null) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };

    const scheduleCollapse = () => {
      clearTimer();
      collapseTimerRef.current = setTimeout(() => {
        setFilterChipCollapsed(true);
        collapseTimerRef.current = null;
      }, ms);
    };

    let cleanup: (() => void) | undefined;
    let rafId = 0;
    let cancelled = false;

    const bind = (root: HTMLElement) => {
      const onPointerDown = () => {
        setFilterChipCollapsed(false);
        scheduleCollapse();
      };
      root.addEventListener("pointerdown", onPointerDown);
      // Tab opened, panel mounted, or full page load — start collapse countdown immediately.
      setFilterChipCollapsed(false);
      scheduleCollapse();
      return () => {
        root.removeEventListener("pointerdown", onPointerDown);
        clearTimer();
      };
    };

    const root = rootRef.current;
    if (root) {
      cleanup = bind(root);
    } else {
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        const el = rootRef.current;
        if (el) cleanup = bind(el);
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      cleanup?.();
      clearTimer();
    };
  }, [collapseFilterChipAfterMs, collapseInteractionRootRef]);

  const findOption = (id: string): FilterOption | undefined => {
    const primary = primaryOptions.find((option) => option.id === id);
    if (primary) return primary;
    for (const group of secondaryGroups) {
      const match = group.options.find((option) => option.id === id);
      if (match) return match;
    }
    return undefined;
  };

  const favouriteChips: FavouriteChipView[] = favouritesKey
    ? favourites.flatMap((item): FavouriteChipView[] => {
        if (item.kind === "sort") {
          const option = sortOptions.find((entry) => entry.id === item.id);
          if (!option || !onSortChange) return [];
          return [
            {
              item,
              label: option.label,
              selected: sortBy === item.id,
              onActivate: () => onSortChange(item.id),
            },
          ];
        }
        if (item.kind === "category") {
          const group = secondaryGroups.find((entry) => entry.id === item.id);
          if (!group) return [];
          return [
            {
              item,
              label: group.label,
              selected: group.options.some((option) => selectedFilters.has(option.id)),
              onActivate: () => {
                setSortSession(null);
                handleCategoryClick(group.id);
              },
            },
          ];
        }
        const option = findOption(item.id);
        if (!option) return [];
        const status = TASK_STATUS_ORDER.map((key) => TASK_STATUS_VISUALS[key]).find(
          (visual) => visual.filterId === item.id
        );
        if (status) {
          const Icon = status.Icon;
          const open = status.status === "open";
          return [
            {
              item,
              label: status.shortLabel,
              selected: selectedFilters.has(option.id),
              onActivate: () => handleFilterToggle(option.id),
              icon: <Icon />,
              iconClassName: status.filterIconClassName,
              selectedSurfaceClassName: status.blockClassName,
              selectedIconClassName: open ? status.filterIconClassName : "text-white",
              selectedLabelClassName: open ? "text-muted-foreground" : "text-white",
            },
          ];
        }
        const iconColor = favouriteIconColor(option);
        return [
          {
            item,
            label: option.label,
            selected: selectedFilters.has(option.id),
            onActivate: () => handleFilterToggle(option.id),
            icon: iconColor ? tintIcon(option.icon, iconColor) : option.icon,
          },
        ];
      })
    : [];

  // Render chip with animation - uses the canonical 28px FilterChip height
  const renderChip = (
    option: FilterOption,
    index: number,
    isSelected: boolean,
    onClick: () => void
  ) => {
    const chip = (
      <FilterChip
        label={option.label}
        selected={isSelected}
        onSelect={onClick}
        icon={option.icon ? React.cloneElement(option.icon as React.ReactElement, { className: "h-[14px] w-[14px]" }) : undefined}
        color={option.color}
        className="!duration-300 ease-out"
      />
    );
    if (!favouritesKey) return <React.Fragment key={option.id}>{chip}</React.Fragment>;
    return (
      <HoldToDrag
        key={option.id}
        item={{ kind: "option", id: option.id }}
        source="menu"
        label={option.label}
      >
        {chip}
      </HoldToDrag>
    );
  };

  const renderMenuChip = (
    item: FilterFavourite,
    label: string,
    chip: React.ReactNode
  ) => {
    if (!favouritesKey) return chip;
    return (
      <HoldToDrag key={`${item.kind}:${item.id}`} item={item} source="menu" label={label}>
        {chip}
      </HoldToDrag>
    );
  };

  // Render icon button - 28px to match chip height
  const renderIconButton = (
    icon: React.ReactNode,
    onClick: () => void,
    className?: string,
    active?: boolean
  ) => (
    <IconButton
      role="filter-toggle"
      icon={icon}
      onClick={onClick}
      active={active}
      size={28}
      className={className}
    />
  );

  // Render back button
  const renderBackButton = () => renderIconButton(
    <ArrowLeftToLine className="h-[14px] w-[14px] text-foreground" />,
    handleBackClick
  );

  // Wipe between levels: slightly snappier than global 0.3s; `both` avoids a one-frame flash.
  const getAnimationClass = () => {
    if (!animationDirection) return "";
    return animationDirection === "right-to-left"
      ? "animate-[wipe-right-to-left_0.2s_ease-out_both]"
      : "animate-[wipe-left-to-right_0.2s_ease-out_both]";
  };

  const clearControl = hasClearableFilters ? (
    <RemoveFilterButton onClick={handleClearAllFilters} />
  ) : null;

  const column = (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
    <div className="flex items-center justify-between gap-2 min-h-[36px]">
      {/* Scroll track: a few px inset so neumorphic outer shadows are not clipped */}
      <div className="chip-row-scroll flex flex-1 min-w-0 items-center gap-2 py-[5px] pl-[3px] pr-2">
        <div 
          key={sortSession ? "sort" : `${navigationLevel}-${selectedCategory || 'none'}`}
          className={cn(
            "flex h-[28px] items-center gap-[5px] flex-nowrap min-w-max",
            navigationLevel === "primary" && !sortSession && "transition-[gap] duration-300 ease-out",
            getAnimationClass()
          )}
        >
          {sortSession ? (
            <>
              <IconButton
                role="filter-toggle"
                icon={<ArrowLeftToLine className="h-[14px] w-[14px] text-foreground" />}
                onClick={closeSort}
                size={28}
                aria-label="Close sort"
              />
              <RemoveFavouriteSlot />
              {sortSession.options.map((option) =>
                renderMenuChip(
                  { kind: "sort", id: option.id },
                  option.label,
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={sortSession.sortBy === option.id}
                    onSelect={() => handleSortSelect(option.id)}
                    className="!duration-300 ease-out"
                  />
                )
              )}
            </>
          ) : null}

          {/* Level 1: Primary filters + Filter By button */}
          {!sortSession && navigationLevel === 'primary' && (
            <>
              {!hideFilterByButton ? (
                <button
                  type="button"
                  data-filter-primary-trigger
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleFilterByClick}
                  aria-label={filterChipCollapsed ? "Filter — open categories" : "Filter by category"}
                  title="Filter"
                  className={cn(
                    "inline-flex items-center py-0 rounded-[8px] flex-shrink-0 overflow-hidden h-[28px]",
                    "font-mono text-2xs uppercase tracking-wide leading-none",
                    "select-none cursor-pointer",
                    "bg-background",
                    "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-1px_-2px_2px_0px_rgba(255,255,255,0.9)]",
                    "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card",
                    "transition-[gap,padding,min-width] duration-300 ease-out",
                    filterChipCollapsed
                      ? "justify-center gap-0 px-0 min-w-[28px]"
                      : "justify-start gap-1.5 pl-2 pr-2.5 min-w-0"
                  )}
                >
                  <Funnel className={cn("h-[14px] w-[14px] text-foreground shrink-0")} />
                  <span
                    className={cn(
                      "whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-out",
                      filterChipCollapsed ? "max-w-0 opacity-0" : "max-w-[5rem] opacity-100"
                    )}
                  >
                    FILTER
                  </span>
                </button>
              ) : null}
              <RemoveFavouriteSlot />
              {mostUsedOptions.map((option, index) => {
                const isSelected = selectedFilters.has(option.id);
                return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
              })}
              {afterFilterTrigger}
              {primaryTrailing}
              {clearControl}
            </>
          )}

          {/* Level 2: Category chips + Back button */}
          {!sortSession && navigationLevel === 'categories' && (
            <>
              {renderBackButton()}
              <RemoveFavouriteSlot />
              {secondaryGroups.map((group) =>
                renderMenuChip(
                  { kind: "category", id: group.id },
                  group.label,
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleCategoryClick(group.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0 rounded-[8px] flex-shrink-0 h-[28px]",
                      "font-mono text-2xs uppercase tracking-wide leading-none",
                      "select-none cursor-pointer transition-all",
                      "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                    )}
                  >
                    <span>{group.label}</span>
                  </button>
                )
              )}
              {clearControl}
            </>
          )}

          {/* Level 3: Category options + Back button */}
          {!sortSession && navigationLevel === 'options' && selectedGroup && (
            <>
              {renderBackButton()}
              <RemoveFavouriteSlot />
              {selectedGroup.options.map((option, index) => {
                const isSelected = selectedFilters.has(option.id);
                return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
              })}
              {clearControl}
            </>
          )}
        </div>
      </div>

      {/* Right element (e.g., View Toggle) */}
      {rightElement && (
        <div className="flex items-center flex-shrink-0">
          {rightElement}
        </div>
      )}
    </div>
    {favouritesKey ? (
      <FilterFavouritesRow chips={favouriteChips} leading={favouritesLeading} />
    ) : null}
    </div>
  );

  return (
    <FilterRowSortContext.Provider value={sortRowApi}>
      {favouritesKey ? (
        <FavouriteDragProvider onDrop={handleFavouriteDrop}>{column}</FavouriteDragProvider>
      ) : (
        column
      )}
    </FilterRowSortContext.Provider>
  );
}

function RemoveFilterButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove filter"
      className={cn(
        "group/clear inline-flex h-[28px] min-w-[28px] shrink-0 items-center overflow-hidden rounded-[8px]",
        "cursor-pointer select-none bg-background text-muted-foreground",
        "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
        "gap-0 pr-0 transition-[padding,gap,box-shadow,background-color] duration-300 ease-out",
        "hover:gap-1.5 hover:bg-card hover:pr-2.5",
        "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
      )}
    >
      <span className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center">
        <FunnelX className="h-[14px] w-[14px]" />
      </span>
      <span
        className={cn(
          "max-w-0 overflow-hidden whitespace-nowrap font-mono text-2xs uppercase tracking-wide opacity-0",
          "transition-[max-width,opacity] duration-300 ease-out",
          "group-hover/clear:max-w-[8rem] group-hover/clear:opacity-100"
        )}
      >
        Remove filter
      </span>
    </button>
  );
}
