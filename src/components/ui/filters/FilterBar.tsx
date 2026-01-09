import { useState, useEffect } from "react";
import { ArrowLeftToLine, Building2, Home, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom Funnel icon component (not available in lucide-react)
const Funnel = ({ className, style, ...props }: React.SVGProps<SVGSVGElement>) => (
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
    className={cn("lucide lucide-funnel", className)}
    style={style}
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
  properties?: Array<{ id: string; icon_name?: string; icon_color_hex?: string }>; // Properties to display as filter chips
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
  properties = [],
}: FilterBarProps) {
  const [navigationLevel, setNavigationLevel] = useState<NavigationLevel>('primary');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'right-to-left' | 'left-to-right' | null>(null);

  // Limit primary options to first 3 (most used)
  const mostUsedOptions = primaryOptions.slice(0, 3);

  const selectedGroup = selectedCategory 
    ? secondaryGroups.find(g => g.id === selectedCategory)
    : null;

  const handleFilterToggle = (filterId: string) => {
    const isSelected = selectedFilters.has(filterId);
    onFilterChange(filterId, !isSelected);
  };

  const handleFilterByClick = () => {
    setAnimationDirection('right-to-left');
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
      setAnimationDirection('left-to-right');
      setNavigationLevel('primary');
      setSelectedCategory(null);
    }
  };

  const handleClearAllFilters = () => {
    // Clear all selected filters
    selectedFilters.forEach(filterId => {
      onFilterChange(filterId, false);
    });
  };

  // #region agent log
  // Verify icons are defined after fix
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FilterBar.tsx:97',message:'Post-fix icon verification',data:{funnelDefined:typeof Funnel !== 'undefined',arrowLeftToLineDefined:typeof ArrowLeftToLine !== 'undefined',funnelXDefined:typeof FunnelX !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  }, []);
  // #endregion


  // Reset animation direction after animation completes
  useEffect(() => {
    if (animationDirection) {
      const timer = setTimeout(() => setAnimationDirection(null), 300);
      return () => clearTimeout(timer);
    }
  }, [animationDirection, navigationLevel, selectedCategory]);

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
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] flex-shrink-0",
        "font-mono text-[13px] uppercase tracking-wide",
        "select-none cursor-pointer transition-all",
        isSelected
          ? // Active: Pressed neumorphic with off-white fill
            "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
          : // Inactive: Transparent with neumorphic shadows
            "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
        option.color && isSelected && "text-white"
      )}
      style={{
        ...(isSelected && option.color ? { backgroundColor: option.color } : {}),
      }}
    >
      {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
      <span>{option.label}</span>
    </button>
  );

  // Render icon button with neumorphic styling - matches AISuggestionChip style
  const renderIconButton = (
    icon: React.ReactNode,
    onClick: () => void,
    className?: string
  ) => {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FilterBar.tsx:150',message:'renderIconButton called',data:{iconType:typeof icon,iconIsUndefined:icon===undefined,iconIsNull:icon===null,iconName:icon?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
    } catch (e: any) {
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FilterBar.tsx:150',message:'renderIconButton error',data:{error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center h-[35px] w-[35px] rounded-[8px] flex-shrink-0",
          "select-none cursor-pointer transition-all",
          "bg-background shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
          "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
          className
        )}
      >
        {icon}
      </button>
    );
  };

  // Render back button
  const renderBackButton = () => renderIconButton(
    <ArrowLeftToLine className="h-5 w-5 text-foreground" />,
    handleBackClick
  );

  // Determine animation class based on direction
  const getAnimationClass = () => {
    if (!animationDirection) return '';
    return animationDirection === 'right-to-left' 
      ? 'animate-wipe-right-to-left'
      : 'animate-wipe-left-to-right';
  };

  return (
    <div className={cn("flex items-center justify-between gap-2 min-h-[42px]", className)}>
      {/* Single Row Container - horizontally scrollable */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0 h-[42px]">
        <div 
          key={`${navigationLevel}-${selectedCategory || 'none'}`}
          className={cn(
            "flex items-center gap-2 flex-nowrap min-w-max",
            getAnimationClass()
          )}
        >
          {/* Level 1: Primary filters + Filter By button */}
          {navigationLevel === 'primary' && (
            <>
              {/* #region agent log */}
              {(() => {
                try {
                  const funnelEl = <Funnel className="h-4 w-4 text-foreground" />;
                  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FilterBar.tsx:244',message:'Creating Funnel element',data:{funnelDefined:typeof Funnel !== 'undefined',funnelType:typeof Funnel},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'D'})}).catch(()=>{});
                  return renderIconButton(funnelEl, handleFilterByClick);
                } catch (e: any) {
                  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FilterBar.tsx:244',message:'Error creating Funnel',data:{error:e?.message,stack:e?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'D'})}).catch(()=>{});
                  return null;
                }
              })()}
              {/* FunnelX (Clear filters) - appears when filters are selected */}
              {selectedFilters.size > 0 && (
                <button
                  onClick={handleClearAllFilters}
                  className={cn(
                    "inline-flex items-center justify-center h-[35px] w-[35px] rounded-[8px] flex-shrink-0",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
                    "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <FunnelX className="h-4 w-4" />
                </button>
              )}
              {/* Property filter chips */}
              {properties.map((property) => {
                const filterId = `filter-property-${property.id}`;
                const isSelected = selectedFilters.has(filterId);
                const iconName = property.icon_name || "home";
                const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
                const propertyColor = property.icon_color_hex || "#8EC9CE";
                
                // Convert hex to rgba for muted background (12% opacity)
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                const mutedPropertyColor = hexToRgba(propertyColor, 0.12);
                
                return (
                  <button
                    key={property.id}
                    onClick={() => handleFilterToggle(filterId)}
                    className={cn(
                      "inline-flex items-center justify-center w-[24px] h-[35px] rounded-[8px] flex-shrink-0",
                      "select-none cursor-pointer transition-all",
                      isSelected
                        ? "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                        : "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                    )}
                    style={{
                      backgroundColor: isSelected ? propertyColor : mutedPropertyColor,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = propertyColor;
                        const icon = e.currentTarget.querySelector('svg');
                        if (icon) icon.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = mutedPropertyColor;
                        const icon = e.currentTarget.querySelector('svg');
                        if (icon) icon.style.color = propertyColor;
                      }
                    }}
                  >
                    <IconComponent 
                      className="h-4 w-4 transition-colors" 
                      style={{
                        color: isSelected ? 'white' : propertyColor
                      }} 
                    />
                  </button>
                );
              })}
              {/* #endregion */}
              {mostUsedOptions.map((option, index) => {
                const isSelected = selectedFilters.has(option.id);
                return renderChip(option, index, isSelected, () => handleFilterToggle(option.id));
              })}
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
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] flex-shrink-0",
                    "font-mono text-[13px] uppercase tracking-wide",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <span>{group.label}</span>
                </button>
              ))}
              {selectedFilters.size > 0 && (
                <button
                  onClick={handleClearAllFilters}
                  className={cn(
                    "inline-flex items-center justify-center h-[35px] w-[35px] rounded-[8px] flex-shrink-0",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
                    "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <FunnelX className="h-4 w-4" />
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
              {selectedFilters.size > 0 && (
                <button
                  onClick={handleClearAllFilters}
                  className={cn(
                    "inline-flex items-center justify-center h-[35px] w-[35px] rounded-[8px] flex-shrink-0",
                    "select-none cursor-pointer transition-all",
                    "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
                    "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <FunnelX className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right element (e.g., View Toggle) - Desktop only */}
      {rightElement && (
        <div className="hidden lg:flex items-center flex-shrink-0">
          {rightElement}
        </div>
      )}
    </div>
  );
}
