import React, { useState, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { ArrowLeftToLine, Building2, Home, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/chips/filter";
import { IconButton } from "@/components/ui/IconButton";

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
}

type NavigationLevel = 'primary' | 'categories' | 'options';

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
  primaryOptionLimit = 3,
  clearPreservePrefixes = ['filter-property-'],
  onClearAll,
  showClearButton,
  collapseFilterChipAfterMs,
  collapseInteractionRootRef,
}: FilterBarProps) {
  const [navigationLevel, setNavigationLevel] = useState<NavigationLevel>('primary');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'right-to-left' | 'left-to-right' | null>(null);
  const [filterChipCollapsed, setFilterChipCollapsed] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleFilterByClick = () => {
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

  // Render chip with animation - now uses unified Chip component
  // FilterBar chips: 24px height, 11px text, 14x14px icons
  const renderChip = (
    option: FilterOption,
    index: number,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <FilterChip
      key={option.id}
      label={option.label}
      selected={isSelected}
      onSelect={onClick}
      icon={option.icon ? React.cloneElement(option.icon as React.ReactElement, { className: "h-[14px] w-[14px]" }) : undefined}
      color={option.color}
      className="h-[24px] !duration-300 ease-out"
    />
  );

  // Render icon button - now uses unified IconButton component
  // Updated to 24px to match chip height
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
      size={24}
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

  return (
    <div className={cn("flex items-center justify-between gap-2 min-h-[24px]", className)}>
      {/* Single Row Container - horizontally scrollable */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0 h-[28px] px-[5px]">
        <div 
          key={`${navigationLevel}-${selectedCategory || 'none'}`}
          className={cn(
            "flex items-center gap-[5px] flex-nowrap min-w-max",
            navigationLevel === "primary" && "transition-[gap] duration-300 ease-out",
            getAnimationClass()
          )}
        >
          {/* Level 1: Primary filters + Filter By button */}
          {navigationLevel === 'primary' && (
            <>
              <button
                type="button"
                data-filter-primary-trigger
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleFilterByClick}
                aria-label={filterChipCollapsed ? "Filter — open categories" : "Filter by category"}
                title="Filter"
                className={cn(
                  "inline-flex items-center py-1 rounded-[8px] flex-shrink-0 overflow-hidden h-6",
                  "font-mono text-[11px] uppercase tracking-wider",
                  "select-none cursor-pointer",
                  "bg-background",
                  "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-1px_-2px_2px_0px_rgba(255,255,255,0.9)]",
                  "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card",
                  "transition-[gap,padding,min-width] duration-300 ease-out",
                  filterChipCollapsed
                    ? "justify-center gap-0 px-0 min-w-[24px]"
                    : "justify-start gap-1.5 pl-2 pr-2.5 min-w-0"
                )}
              >
                <Funnel className={cn("h-[14px] w-[14px] text-foreground shrink-0")} />
                <span
                  className={cn(
                    "whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-out",
                    filterChipCollapsed ? "max-w-0 opacity-0" : "max-w-[5rem] opacity-100"
                  )}
                  style={{ letterSpacing: filterChipCollapsed ? 0 : "0.325px" }}
                >
                  FILTER
                </span>
              </button>
              {hasClearableFilters && (
                renderIconButton(
                  <FunnelX className="h-[14px] w-[14px] text-foreground" />,
                  handleClearAllFilters
                )
              )}
              {mostUsedOptions.map((option, index) => {
                const isSelected = selectedFilters.has(option.id);
                return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
              })}
              {primaryTrailing}
            </>
          )}

          {/* Level 2: Category chips + Back button */}
          {navigationLevel === 'categories' && (
            <>
              {renderBackButton()}
              {secondaryGroups.map((group, index) => (
                <button
                  key={group.id}
                  onClick={() => handleCategoryClick(group.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] flex-shrink-0 h-[24px]",
                    "font-mono text-[11px] uppercase tracking-wide",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <span>{group.label}</span>
                </button>
              ))}
              {hasClearableFilters && (
                <button
                  onClick={handleClearAllFilters}
                  className={cn(
                    "inline-flex items-center justify-center h-[24px] w-[24px] rounded-[8px] flex-shrink-0",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
                    "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <FunnelX className="h-[14px] w-[14px]" />
                </button>
              )}
            </>
          )}

          {/* Level 3: Category options + Back button */}
          {navigationLevel === 'options' && selectedGroup && (
            <>
              {renderBackButton()}
              {selectedGroup.options.map((option, index) => {
                const isSelected = selectedFilters.has(option.id);
                return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
              })}
              {hasClearableFilters && (
                <button
                  onClick={handleClearAllFilters}
                  className={cn(
                    "inline-flex items-center justify-center h-[24px] w-[24px] rounded-[8px] flex-shrink-0",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
                    "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <FunnelX className="h-[14px] w-[14px]" />
                </button>
              )}
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
  );
}
