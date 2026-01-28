import { useMemo, useState, useRef, useEffect } from "react";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { togglePropertyFilter } from "@/utils/propertyFilter";
import { Plus, Home, Building2, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeftColumnProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  propertiesLoading?: boolean;
  selectedDate?: Date | undefined;
  onDateSelect?: (date: Date | undefined) => void;
  tasksByDate?: Map<string, {
    total: number;
    high: number;
    urgent: number;
    overdue: number;
  }>;
  urgentCount?: number;
  overdueCount?: number;
  onFilterClick?: (filterId: string) => void;
  selectedPropertyIds?: Set<string>;
  onPropertySelectionChange?: (propertyIds: Set<string>) => void;
}

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed 350px width, sticky on scroll
 * Mobile: Full width, stacked above RightColumn
 */
export function LeftColumn({ 
  tasks = [], 
  properties = [], 
  tasksLoading = false,
  propertiesLoading = false,
  selectedDate,
  onDateSelect,
  tasksByDate,
  urgentCount,
  overdueCount,
  onFilterClick,
  selectedPropertyIds: externalSelectedPropertyIds,
  onPropertySelectionChange
}: LeftColumnProps) {
  const { orgId } = useActiveOrg();
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [hideProperties, setHideProperties] = useState(false);
  const [internalSelectedPropertyIds, setInternalSelectedPropertyIds] = useState<Set<string>>(
    () => new Set()
  );
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);

  // Use external selectedPropertyIds if provided, otherwise use internal state
  const selectedPropertyIds = externalSelectedPropertyIds !== undefined 
    ? externalSelectedPropertyIds 
    : internalSelectedPropertyIds;
  
  const setSelectedPropertyIds = onPropertySelectionChange || setInternalSelectedPropertyIds;

  // ALL_PROPERTIES: full list of property IDs (N ≥ 1). Active set never empty; ALL = all active.
  const ALL_PROPERTY_IDS = useMemo(() => properties.map((p: { id: string }) => p.id), [properties]);

  // When using internal state, initialise to ALL when properties load (never empty).
  useEffect(() => {
    if (externalSelectedPropertyIds !== undefined) return;
    if (properties.length > 0) {
      setInternalSelectedPropertyIds((prev) =>
        prev.size === 0 ? new Set(ALL_PROPERTY_IDS) : prev
      );
    }
  }, [ALL_PROPERTY_IDS, properties.length, externalSelectedPropertyIds]);

  // Extract task counts from properties_view (properties now have open_tasks_count)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p: any) => {
      counts[p.id] = p.open_tasks_count || 0;
    });
    return counts;
  }, [properties]);

  // Calculate urgent task counts per property
  const urgentTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (
        task.property_id &&
        (task.priority === 'urgent' || task.priority === 'high') &&
        task.status !== 'completed' &&
        task.status !== 'archived'
      ) {
        counts[task.property_id] = (counts[task.property_id] || 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  // Property icon mapping
  const PROPERTY_ICONS = {
    home: Home,
    building: Building2,
    hotel: Hotel,
    warehouse: Warehouse,
    store: Store,
    castle: Castle,
  } as const;

  return (
    <div 
      ref={leftColumnRef}
      className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties Section - Fixed at top */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background p-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Properties</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAddProperty(true)}
                className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30"
                style={{
                  width: '35px',
                  height: '35px',
                }}
                aria-label="Add property"
              >
                <Plus className="h-4 w-[18px] text-muted-foreground" style={{ width: '18px', height: '16px' }} />
              </button>
              {/* Property Icon Buttons - Aligned Right */}
              {properties.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {properties.map((property) => {
                    const iconName = property.icon_name || "home";
                    const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
                    const iconColor = property.icon_color_hex || "#8EC9CE";
                    const isAllActive = selectedPropertyIds.size === ALL_PROPERTY_IDS.length;
                    const isActive = isAllActive || selectedPropertyIds.has(property.id);
                    
                    return (
                      <button
                        key={property.id}
                        onClick={() => {
                          const newSelection = togglePropertyFilter(
                            property.id,
                            selectedPropertyIds,
                            ALL_PROPERTY_IDS
                          );
                          setSelectedPropertyIds(newSelection);
                          if (onFilterClick) {
                            onFilterClick(`filter-property-${property.id}`);
                          }
                        }}
                        className="flex items-center justify-center rounded-[12px] transition-all duration-200 hover:scale-110 active:scale-95"
                        style={{
                          width: '35px',
                          height: '35px',
                          backgroundColor: isActive ? iconColor : 'transparent',
                          boxShadow: isActive 
                            ? "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05)"
                            : "none",
                          borderColor: "rgba(0, 0, 0, 0)",
                          borderStyle: "none",
                          borderImage: "none",
                        }}
                        aria-label={`Filter by ${property.nickname || property.address}`}
                      >
                        <IconComponent className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        {!hideProperties && (
        <div className="px-4 w-full max-w-full overflow-x-hidden" style={{ height: '228px' }}>
          {propertiesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No properties yet</p>
            </div>
          ) : (
            <div 
              ref={propertiesRef}
              className="relative w-full max-w-full overflow-x-hidden overflow-y-visible"
              style={{ borderRadius: '13px 13px 10px 0px' }}
            >
              <div className="overflow-x-auto overflow-y-hidden -ml-4 pl-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-w-0" style={{ height: '228px', width: 'calc(100% + 15px)' }}>
                <div className="flex gap-3 items-start py-2" style={{ width: 'max-content', height: '229px' }}>
                  {properties.map((property) => (
                    <div key={property.id} className="w-[195px] flex-shrink-0" style={{ maxHeight: '228px' }}>
                      <PropertyCard
                        property={{
                          ...property,
                          taskCount: taskCounts[property.id] || 0,
                          urgentTaskCount: urgentTaskCounts[property.id] || 0,
                          lastInspectedDate: null, // TODO: Add last inspected date from compliance data
                        }}
                        onFilterClick={(propertyId) => {
                          if (onFilterClick) {
                            onFilterClick(`filter-property-${propertyId}`);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Gradient overlay - right side fade, aligned to right edge of mask */}
              <div 
                className="absolute top-0 right-0 bottom-0 pointer-events-none"
                style={{
                  width: '10px',
                  background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))',
                  zIndex: 20
                }}
              />
            </div>
          )}
        </div>
        )}
      </div>

      {/* Calendar Section - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div
          ref={calendarRef}
          className="flex-shrink-0 w-full"
        >
          <div className="px-4 pt-4 pb-4 w-full">
            {tasksLoading ? (
              <div className="rounded-lg bg-card p-3 shadow-e1 w-full">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="rounded-lg bg-card p-3 shadow-e1 w-full">
                <DashboardCalendar
                  tasks={tasks}
                  selectedDate={selectedDate}
                  onDateSelect={onDateSelect}
                  tasksByDate={tasksByDate}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />
    </div>
  );
}

