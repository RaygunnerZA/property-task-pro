import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WorkbenchMobileNavCluster } from "@/components/layout/WorkbenchMobileNavCluster";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyIdentityStrip } from "@/components/properties/PropertyIdentityStrip";
import type { PropertyCardWeather } from "@/types/propertyCardWeather";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import { OnboardingDemoBanner } from "@/components/onboarding/OnboardingDemoBanner";
import { propertyHasOnboardingDemoContent } from "@/lib/onboardingDemo";
import { InstructionPanel, instructionPanelStorageKey } from "@/components/filla/InstructionPanel";
import { Button } from "@/components/ui/button";
import { HubSummaryPanel } from "@/components/dashboard/HubSummaryPanel";

const WORKBENCH_OVERVIEW_TIP_ID = "workbench-overview";

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
  /** e.g. workbench property scope chips — kept in the 265px column, not full workbench width */
  scopeFilterBar?: ReactNode;
  /** When non-null, identity strip shows Today + weather on the thumbnail (dashboard passes briefing weather). */
  propertyCardWeather?: PropertyCardWeather;
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
  scopeFilterBar,
  propertyCardWeather,
}: LeftColumnProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHubHome = pathname === "/" || pathname === "";
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [workbenchTipDismissed, setWorkbenchTipDismissed] = useState(() => {
    try {
      return (
        typeof localStorage !== "undefined" &&
        localStorage.getItem(instructionPanelStorageKey(WORKBENCH_OVERVIEW_TIP_ID)) === "1"
      );
    } catch {
      return false;
    }
  });
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

  // Single selected property: identity strip; multiple: horizontal cards.
  const focusedProperty = useMemo(() => {
    if (selectedPropertyIds.size !== 1) return null;
    const id = Array.from(selectedPropertyIds)[0];
    return (properties as any[]).find((p) => p.id === id) ?? null;
  }, [selectedPropertyIds, properties]);

  const showOnboardingDemoBanner = useMemo(() => {
    if (!focusedProperty?.id) return false;
    return propertyHasOnboardingDemoContent(tasks, focusedProperty.id);
  }, [tasks, focusedProperty?.id]);

  return (
    <div 
      ref={leftColumnRef}
      className="h-auto sm:h-screen flex flex-col overflow-y-auto sm:overflow-hidden w-full max-w-full px-0"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties: scope chips + cards / identity strip */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background py-2 pl-0 pr-[5px]">
        {scopeFilterBar}
        {isHubHome && !scopeFilterBar && (
          <div className="flex justify-end px-[12px] pb-1 pt-0 lg:hidden">
            <WorkbenchMobileNavCluster />
          </div>
        )}
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
            <div ref={propertiesRef} className="relative w-full max-w-full min-w-0 pt-[2px] pb-[7px] max-sm:px-0 sm:pr-[5px]">
              {showOnboardingDemoBanner && (
                <OnboardingDemoBanner
                  propertyId={focusedProperty.id}
                  className="mx-0 mb-2 max-sm:px-[12px] sm:mx-0"
                />
              )}
              <PropertyIdentityStrip
                key={focusedProperty.id}
                property={focusedProperty}
                onAddTaskClick={onOpenIntake ? () => onOpenIntake("report_issue") : undefined}
                urgentOpenTaskCount={urgentTaskCounts[focusedProperty.id] ?? 0}
                onOpenTasksClick={
                  onFilterClick ? () => onFilterClick("show-tasks") : undefined
                }
                onFilterClick={onFilterClick}
                onPropertyArchived={() => {
                  setSelectedPropertyIds(new Set(ALL_PROPERTY_IDS));
                  onFilterClick?.("show-tasks");
                }}
                propertyCardWeather={propertyCardWeather}
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
                <div className="flex gap-4 items-start py-2" style={{ width: 'max-content', height: '228px' }}>
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
      </div>

      {isHubHome && !focusedProperty && !propertiesLoading && properties.length > 0 ? (
        <HubSummaryPanel
          tasks={tasks}
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          loading={tasksLoading}
          onOpenTasks={onFilterClick ? () => onFilterClick("show-tasks") : undefined}
          onOpenUrgentTasks={onFilterClick ? () => onFilterClick("show-tasks-urgent") : undefined}
          onOpenSpaces={onFilterClick ? () => onFilterClick("show-spaces") : undefined}
          onOpenAssets={onFilterClick ? () => onFilterClick("show-assets") : undefined}
          onDueSoon={onFilterClick ? () => onFilterClick("filter-date-this-week") : undefined}
          onOverdue={onFilterClick ? () => onFilterClick("filter-date-overdue") : undefined}
          onMissingInfo={onFilterClick ? () => onFilterClick("filter-task-missing-info") : undefined}
        />
      ) : null}

      {/* Calendar Section - Scrollable (no horizontal pan — avoid sideways slide on touch/trackpad) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 touch-pan-y overscroll-x-contain">
        <div
          ref={calendarRef}
          className="flex-shrink-0 w-full min-w-0 max-w-full overflow-x-hidden px-[3px]"
        >
          <div className="px-0 w-full min-w-0 max-w-[250px] overflow-x-hidden">
            {tasksLoading ? (
              <div className="w-full max-w-[252px] rounded-lg bg-transparent px-0 pt-4 pb-2 pr-0 shadow-none">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="w-full max-w-[252px] rounded-lg bg-transparent px-0 pt-4 pb-2 pr-0 shadow-none">
                <FillaMiniCalendar
                  tasks={tasks}
                  selectedDate={selectedDate}
                  onDateSelect={onDateSelect}
                  tasksByDate={tasksByDate}
                />
              </div>
            )}
          </div>
          {isHubHome && !workbenchTipDismissed && (
            <div className="mt-5 shrink-0 px-gutter-rail pb-4 sm:pr-2">
              <InstructionPanel
                id={WORKBENCH_OVERVIEW_TIP_ID}
                denseRail
                title="How this column works"
                description="Pick a date to focus the task list in the middle. Use the property row above to narrow work to one building, or keep every property selected to see everything at once."
                onDismiss={() => {
                  try {
                    localStorage.setItem(
                      instructionPanelStorageKey(WORKBENCH_OVERVIEW_TIP_ID),
                      "1",
                    );
                  } catch {
                    /* ignore */
                  }
                  setWorkbenchTipDismissed(true);
                }}
                action={
                  <Button type="button" size="sm" onClick={() => navigate("/work/tasks")}>
                    Open tasks
                  </Button>
                }
              />
            </div>
          )}
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

