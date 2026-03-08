import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { togglePropertyFilter } from "@/utils/propertyFilter";
import { Plus, Home, Building2, Hotel, Warehouse, Store, Castle, Package, CheckSquare, Shield, Clock, Zap, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarConcertina } from "@/components/layout/SidebarConcertina";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  onCreateTask?: () => void;
  onTaskClick?: (taskId: string) => void;
}

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed 280px width, sticky on scroll
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
  onPropertySelectionChange,
  onCreateTask,
  onTaskClick,
}: LeftColumnProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
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

  // Last 5 tasks by updated_at for Recent activity
  const recentTasks = useMemo(() => {
    if (!tasks?.length) return [];
    return [...tasks]
      .sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at).getTime();
        const bT = new Date(b.updated_at || b.created_at).getTime();
        return bT - aT;
      })
      .slice(0, 5);
  }, [tasks]);

  const complianceSummary = useMemo(() => {
    const expired = compliancePortfolio.filter((c: any) => c.expiry_state === "expired").length;
    const expiring = compliancePortfolio.filter((c: any) => c.expiry_state === "expiring").length;
    const valid = compliancePortfolio.filter((c: any) => c.expiry_state === "valid").length;
    return { expired, expiring, valid };
  }, [compliancePortfolio]);

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
      className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full pl-0"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties Section - Fixed at top */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background py-4 px-2 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Properties</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAddProperty(true)}
                className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30"
                style={{
                  width: '20px',
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
        <div className="px-2 w-full max-w-full overflow-x-hidden" style={{ height: '228px' }}>
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
          <div className="px-0 pt-4 pb-4 w-full">
            {tasksLoading ? (
              <div className="rounded-lg bg-card/60 p-3 shadow-e1 w-full">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="rounded-lg bg-card/60 p-3 shadow-e1 w-full">
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

        <SidebarConcertina
          sections={[
            {
              id: "quick-actions",
              title: "Quick actions",
              icon: Zap,
              defaultOpen: false,
              children: (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddProperty(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                    Add Property
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/assets")}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    Add Asset
                  </button>
                  {onCreateTask && (
                    <button
                      type="button"
                      onClick={onCreateTask}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-left"
                    >
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      Create Task
                    </button>
                  )}
                </div>
              ),
            },
            {
              id: "compliance",
              title: "Compliance",
              icon: Shield,
              defaultOpen: false,
              contentClassName: "",
              children: (
                <>
                  {complianceSummary.expired === 0 && complianceSummary.expiring === 0 && complianceSummary.valid === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No compliance items</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {complianceSummary.expired > 0 && (
                        <span className="text-destructive font-medium">{complianceSummary.expired} expired</span>
                      )}
                      {complianceSummary.expired > 0 && (complianceSummary.expiring > 0 || complianceSummary.valid > 0) && " · "}
                      {complianceSummary.expiring > 0 && (
                        <span className="text-amber-600 font-medium">{complianceSummary.expiring} expiring</span>
                      )}
                      {(complianceSummary.expired > 0 || complianceSummary.expiring > 0) && complianceSummary.valid > 0 && " · "}
                      {complianceSummary.valid > 0 && (
                        <span className="text-green-600">{complianceSummary.valid} valid</span>
                      )}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/record/compliance/portfolio")}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    View portfolio →
                  </button>
                </>
              ),
            },
            {
              id: "recent-activity",
              title: "Recent activity",
              icon: Activity,
              defaultOpen: false,
              spacing: "normal",
              children: recentTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No recent activity</p>
              ) : (
                <div className="space-y-1.5">
                  {recentTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onTaskClick?.(task.id)}
                      className={cn(
                        "w-full text-left py-2 rounded-md transition-all",
                        "hover:bg-muted/50",
                        onTaskClick && "cursor-pointer"
                      )}
                    >
                      <p className="text-xs font-medium truncate text-foreground">
                        {(task as any).title || "Untitled Task"}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.updated_at || task.created_at), "MMM d, HH:mm")}
                      </p>
                    </button>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />
    </div>
  );
}

