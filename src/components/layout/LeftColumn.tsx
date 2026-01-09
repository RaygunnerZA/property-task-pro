import { useMemo, useState, useRef } from "react";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { format } from "date-fns";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSpaces } from "@/hooks/useSpaces";
import { Plus, EyeOff, Eye } from "lucide-react";
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
  onFilterClick
}: LeftColumnProps) {
  const { orgId } = useActiveOrg();
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [hideProperties, setHideProperties] = useState(false);
  const [hideSpaces, setHideSpaces] = useState(false);
  const { spaces, loading: spacesLoading, refresh: refreshSpaces } = useSpaces();
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const spacesRef = useRef<HTMLDivElement>(null);

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

  // Calculate task counts per space
  const spaceTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const urgentCounts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.spaces) {
        try {
          const taskSpaces = typeof task.spaces === 'string' ? JSON.parse(task.spaces) : task.spaces;
          if (Array.isArray(taskSpaces)) {
            taskSpaces.forEach((space: any) => {
              if (space?.id && task.status !== 'completed' && task.status !== 'archived') {
                counts[space.id] = (counts[space.id] || 0) + 1;
                if (task.priority === 'urgent' || task.priority === 'high') {
                  urgentCounts[space.id] = (urgentCounts[space.id] || 0) + 1;
                }
              }
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    });
    return { counts, urgentCounts };
  }, [tasks]);


  return (
    <div 
      ref={leftColumnRef}
      className="h-auto md:h-screen bg-background flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full"
    >
      {/* Calendar Section - Fixed at top */}
      <div 
        ref={calendarRef}
        className="flex-shrink-0 border-b border-border w-full"
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

      {/* Properties Section - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Properties</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHideProperties(!hideProperties)}
                className="p-1.5 rounded-[5px] hover:bg-primary/20 text-muted-foreground/60 hover:text-muted-foreground transition-all duration-200"
                aria-label={hideProperties ? "Show properties" : "Hide properties"}
              >
                {hideProperties ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setShowAddProperty(true)}
                className="p-1.5 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200"
                aria-label="Add property"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {!hideProperties && (
        <div className="pt-[2px] px-4 pb-0 w-full max-w-full overflow-x-hidden" style={{ height: '228px' }}>
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
                    <div key={property.id} className="w-[215px] flex-shrink-0" style={{ maxHeight: '228px' }}>
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

        {/* Spaces Section */}
        <div className="border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Spaces</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHideSpaces(!hideSpaces)}
                className="p-1.5 rounded-[5px] hover:bg-primary/20 text-muted-foreground/60 hover:text-muted-foreground transition-all duration-200"
                aria-label={hideSpaces ? "Show spaces" : "Hide spaces"}
              >
                {hideSpaces ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setShowAddSpace(true)}
                className="p-1.5 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200"
                aria-label="Add space"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {!hideSpaces && (
        <div className="pt-[2px] px-4 pb-4 w-full max-w-full overflow-x-hidden">
          {spacesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : spaces.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">No spaces yet</p>
            </div>
          ) : (
            <div 
              ref={spacesRef}
              className="relative w-full max-w-full overflow-hidden"
            >
              <div className="overflow-x-auto -ml-4 pl-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-w-0" style={{ width: 'calc(100% + 15px)' }}>
                <div className="flex gap-2.5 h-[165px]" style={{ width: 'max-content' }}>
                  {spaces.map((space) => (
                    <div key={space.id} className="w-[165px] flex-shrink-0 rounded-[5px]">
                      <SpaceCard
                        space={{
                          ...space,
                          taskCount: spaceTaskCounts.counts[space.id] || 0,
                          urgentTaskCount: spaceTaskCounts.urgentCounts[space.id] || 0,
                        }}
                        onFilterClick={(spaceId) => {
                          if (onFilterClick) {
                            onFilterClick(`filter-space-${spaceId}`);
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
                  height: '155px',
                  background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))',
                  zIndex: 20
                }}
              />
            </div>
          )}
        </div>
        )}
      </div>

      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />

      {/* Add Space Dialog */}
      <AddSpaceDialog
        open={showAddSpace}
        onOpenChange={(open) => {
          setShowAddSpace(open);
          if (!open) {
            refreshSpaces();
          }
        }}
        properties={properties}
      />
    </div>
  );
}

