import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCalendarV2 } from "@/components/dashboard/DashboardCalendarV2";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyIdentityStrip } from "@/components/properties/PropertyIdentityStrip";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { isAllPropertiesActive, togglePropertyFilter } from "@/utils/propertyFilter";
import { Plus, Home, Package, CheckSquare, FileText, Shield, Clock, Zap, Activity, Check } from "lucide-react";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarConcertina } from "@/components/layout/SidebarConcertina";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import {
  intakeAddRecordListRowClassName,
  intakeListRowAddIconClassName,
  intakeListRowReportIconClassName,
  intakeReportIssueListRowClassName,
} from "@/lib/intake-action-buttons";
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
  onOpenIntake?: (mode: IntakeMode) => void;
  onTaskClick?: (taskId: string) => void;
}

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed 265px width, sticky on scroll
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
  onOpenIntake,
  onTaskClick,
}: LeftColumnProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [hideProperties, setHideProperties] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
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

  const isAllActive = useMemo(
    () => isAllPropertiesActive(selectedPropertyIds, ALL_PROPERTY_IDS),
    [selectedPropertyIds, ALL_PROPERTY_IDS]
  );

  /** Multi-property hub: show heading row only when "all" are selected; keep visible for 0-property empty state. */
  const isPropertiesHeadingExpanded = properties.length < 2 || isAllActive;

  // When using internal state, initialise to ALL when properties load (never empty).
  useEffect(() => {
    if (externalSelectedPropertyIds !== undefined) return;
    if (properties.length > 0) {
      setInternalSelectedPropertyIds((prev) =>
        prev.size === 0 ? new Set(ALL_PROPERTY_IDS) : prev
      );
    }
  }, [ALL_PROPERTY_IDS, properties.length, externalSelectedPropertyIds]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

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

  // When exactly one property is selected (and not in multi-select mode), show
  // the PropertyIdentityStrip instead of the card scroller.
  const focusedProperty = useMemo(() => {
    if (isMultiSelectMode || selectedPropertyIds.size !== 1) return null;
    const id = Array.from(selectedPropertyIds)[0];
    return (properties as any[]).find((p) => p.id === id) ?? null;
  }, [selectedPropertyIds, isMultiSelectMode, properties]);

  const handlePropertyPointerDown = (propertyId: string) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsMultiSelectMode(true);
      setSelectedPropertyIds(new Set([propertyId]));
      onFilterClick?.(`filter-property-${propertyId}`);
    }, 1000);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePropertyClick = (propertyId: string) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isMultiSelectMode) {
      const newSelection = togglePropertyFilter(propertyId, selectedPropertyIds, ALL_PROPERTY_IDS);
      setSelectedPropertyIds(newSelection);
      onFilterClick?.(`filter-property-${propertyId}`);
    } else {
      if (selectedPropertyIds.size === 1 && selectedPropertyIds.has(propertyId)) {
        setSelectedPropertyIds(new Set(ALL_PROPERTY_IDS));
        onFilterClick?.("show-tasks");
      } else {
        setSelectedPropertyIds(new Set([propertyId]));
        onFilterClick?.(`filter-property-${propertyId}`);
      }
    }
  };

  return (
    <div 
      ref={leftColumnRef}
      className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full px-0"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties Section - Fixed at top */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background px-0 pb-[7px] pt-[7px]">
          <div className="flex flex-col gap-0">
            {properties.length !== 1 && (
              <div
                className={cn(
                  "overflow-hidden transition-[max-height,opacity,margin-bottom] duration-300 ease-in-out",
                  isPropertiesHeadingExpanded
                    ? "max-h-[52px] opacity-100 mb-2"
                    : "max-h-0 opacity-0 mb-0 pointer-events-none"
                )}
              >
                <div className="flex items-center justify-between">
                  <PanelSectionTitle as="h2" className="mb-0">
                    {properties.length > 1 && isAllActive ? "All Properties" : "Properties"}
                  </PanelSectionTitle>
                  <button
                    onClick={() => setShowAddProperty(true)}
                    className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30"
                    style={{
                      width: "20px",
                      height: "35px",
                    }}
                    aria-label="Add property"
                  >
                    <Plus className="h-4 w-[18px] text-muted-foreground" style={{ width: "18px", height: "16px" }} />
                  </button>
                </div>
              </div>
            )}

            {/* Property Filter Icon Row - only when multiple properties */}
            {properties.length > 1 && (
              <div className="flex flex-col gap-0.5">
                {/* Multi-select mode instruction banner */}
                {isMultiSelectMode && (
                  <div className="flex items-center justify-between px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="text-[10px] text-muted-foreground leading-none">Select multiple properties</span>
                    {selectedPropertyIds.size >= 2 && (
                      <button
                        type="button"
                        onClick={() => setIsMultiSelectMode(false)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors duration-150"
                      >
                        <Check className="h-2.5 w-2.5 text-primary" />
                        <span className="text-[9px] text-primary font-semibold">Done</span>
                      </button>
                    )}
                  </div>
                )}
                <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar" style={{ paddingLeft: '4px', paddingRight: '4px', paddingTop: '3px', paddingBottom: '3px' }}>
                  <div className="flex h-[32px] w-full min-w-max items-center gap-1 pr-0 mx-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPropertyIds(new Set(ALL_PROPERTY_IDS));
                        setIsMultiSelectMode(false);
                        onFilterClick?.("show-tasks");
                      }}
                      className="flex items-center justify-center rounded-[10px] p-0 transition-all duration-300 hover:scale-110 active:scale-95 text-[10px] font-mono font-semibold tracking-wide shrink-0"
                      style={{
                        width: "28px",
                        height: "28px",
                        backgroundColor: isAllActive ? "#8EC9CE" : "transparent",
                        boxShadow: isAllActive
                          ? "2px 2px 5px 0px rgba(0, 0, 0, 0.06), -1px -1px 3px 0px rgba(255, 255, 255, 0.95), inset 1px 1px 2px 0px rgba(255, 255, 255, 1), inset 0px -1px 2px 0px rgba(0, 0, 0, 0.04), 0 0 0 3px rgba(255, 255, 255, 0.75), 0 0 16px 5px rgba(255, 255, 255, 0.55)"
                          : "none",
                        borderColor: "rgba(0, 0, 0, 0)",
                        borderStyle: "none",
                        borderImage: "none",
                      }}
                      aria-label="Show all properties"
                    >
                      <span className={isAllActive ? "text-white drop-shadow-sm" : "text-muted-foreground"}>ALL</span>
                    </button>

                    {properties.map((property) => {
                      const iconName = property.icon_name || "home";
                      const IconComponent = getPropertyChipIcon(iconName);
                      const iconColor = property.icon_color_hex || "#8EC9CE";
                      const isPropertyChipActive = isAllActive || selectedPropertyIds.has(property.id);

                      return (
                        <button
                          key={property.id}
                          onClick={() => handlePropertyClick(property.id)}
                          onPointerDown={() => handlePropertyPointerDown(property.id)}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          className={cn(
                            "flex items-center justify-center rounded-[10px] p-0 transition-all duration-300 hover:scale-110 active:scale-95 shrink-0",
                            isAllActive && "opacity-70 hover:opacity-100"
                          )}
                          style={{
                            width: "28px",
                            height: "28px",
                            backgroundColor: isPropertyChipActive ? iconColor : "transparent",
                            boxShadow: isPropertyChipActive
                              ? isMultiSelectMode
                                ? "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05), 0 0 0 3px white"
                                : "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05)"
                              : "none",
                            borderColor: "rgba(0, 0, 0, 0)",
                            borderStyle: "none",
                            borderImage: "none",
                          }}
                          aria-label={`Filter by ${property.nickname || property.address}`}
                        >
                          <IconComponent
                            className={cn(
                              "h-[18px] w-[16px]",
                              isPropertyChipActive ? "text-white" : "text-muted-foreground"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {!hideProperties && (
        <div
          className="px-0 w-full max-w-full overflow-x-hidden"
          style={{ height: focusedProperty ? 'auto' : '228px' }}
        >
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
          ) : focusedProperty ? (
            /* Single property in focus: show identity strip with sliding cards */
            <div ref={propertiesRef} className="relative w-full max-w-full pt-[2px] pb-[7px] pr-[5px]">
              <PropertyIdentityStrip
                key={focusedProperty.id}
                property={focusedProperty}
                onAddTaskClick={onOpenIntake ? () => onOpenIntake("report_issue") : undefined}
                urgentOpenTaskCount={urgentTaskCounts[focusedProperty.id] ?? 0}
              />
            </div>
          ) : (
            /* Multiple properties selected: horizontal card scroller */
            <div
              ref={propertiesRef}
              className="relative w-full max-w-full overflow-x-hidden overflow-y-visible"
              style={{ borderRadius: '13px 13px 10px 0px' }}
            >
              <div className="overflow-x-auto overflow-y-hidden -ml-4 pl-4 pr-4 scrollbar-hz-teal min-w-0" style={{ height: '228px', width: 'calc(100% + 15px)' }}>
                <div className="flex gap-3 items-start py-2" style={{ width: 'max-content', height: '228px' }}>
                  {properties.map((property) => (
                    <div key={property.id} className="w-[195px] flex-shrink-0" style={{ maxHeight: '228px' }}>
                      <PropertyCard
                        property={{
                          ...property,
                          taskCount: taskCounts[property.id] || 0,
                          urgentTaskCount: urgentTaskCounts[property.id] || 0,
                          lastInspectedDate: null,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Right-side fade scroll affordance */}
              <div
                className="absolute top-0 right-0 bottom-0 pointer-events-none"
                style={{
                  width: '48px',
                  background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.12))',
                  zIndex: 20,
                }}
              />
            </div>
          )}
        </div>
        )}
      </div>

      {/* Calendar Section - Scrollable (no horizontal pan — avoid sideways slide on touch/trackpad) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 touch-pan-y overscroll-x-contain">
        <div
          ref={calendarRef}
          className="flex-shrink-0 w-full min-w-0 max-w-full overflow-x-hidden"
        >
          <div className="px-0 w-full min-w-0 max-w-full overflow-x-hidden">
            {tasksLoading ? (
              <div className="rounded-lg bg-transparent px-0 pt-[15px] pb-[5px] shadow-none w-full">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="rounded-lg bg-transparent px-0 pt-[15px] pb-[5px] shadow-none w-full">
                <DashboardCalendarV2
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
                  {onOpenIntake && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenIntake("add_record")}
                        className={intakeAddRecordListRowClassName}
                      >
                        <FileText className={intakeListRowAddIconClassName} />
                        Add Record
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenIntake("report_issue")}
                        className={intakeReportIssueListRowClassName}
                      >
                        <Plus className={intakeListRowReportIconClassName} />
                        Report Issue
                      </button>
                    </>
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

