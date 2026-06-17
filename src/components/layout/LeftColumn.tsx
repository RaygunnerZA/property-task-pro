import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WorkbenchMobileNavCluster } from "@/components/layout/WorkbenchMobileNavCluster";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { PropertyIdentityStrip } from "@/components/properties/PropertyIdentityStrip";
import { PropertySelectorStack } from "@/components/properties/PropertySelectorStack";
import type { PropertyCardWeather } from "@/types/propertyCardWeather";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import { OnboardingDemoBanner } from "@/components/onboarding/OnboardingDemoBanner";
import { propertyHasOnboardingDemoContent } from "@/lib/onboardingDemo";
import { useEnsureOnboardingDemo } from "@/hooks/useEnsureOnboardingDemo";
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
  /** @deprecated Replaced by PropertySelectorStack inside LeftColumn */
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

  // Single selected property: identity strip below the selector stack.
  const focusedProperty = useMemo(() => {
    if (selectedPropertyIds.size !== 1) return null;
    const id = Array.from(selectedPropertyIds)[0];
    return (properties as any[]).find((p) => p.id === id) ?? null;
  }, [selectedPropertyIds, properties]);

  useEnsureOnboardingDemo(focusedProperty?.id, tasks ?? []);

  const showOnboardingDemoBanner = useMemo(() => {
    if (!focusedProperty?.id) return false;
    return propertyHasOnboardingDemoContent(tasks, focusedProperty.id);
  }, [tasks, focusedProperty?.id]);

  return (
    <div 
      ref={leftColumnRef}
      className="h-auto sm:h-[calc(100vh-var(--header-height))] flex flex-col overflow-y-auto w-full max-w-full px-0"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties: selector stack + identity strip */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background py-2 pl-0 pr-0">
        {scopeFilterBar}
        {!scopeFilterBar && !hideProperties && properties.length > 1 && !propertiesLoading ? (
          <div ref={propertiesRef} className="px-[3px] pb-1 pt-0">
            <PropertySelectorStack
              properties={properties}
              tasks={tasks}
              selectedPropertyIds={selectedPropertyIds}
              onSelectionChange={setSelectedPropertyIds}
              onFilterClick={onFilterClick}
              className="max-w-[247px]"
            />
          </div>
        ) : null}
        {isHubHome && !scopeFilterBar && properties.length <= 1 && (
          <div className="flex justify-end px-[12px] pb-1 pt-0 lg:hidden">
            <WorkbenchMobileNavCluster />
          </div>
        )}
        {!hideProperties && (
        <div className="px-0 w-full max-w-full overflow-x-visible">
          {propertiesLoading ? (
            <div className="space-y-3 px-[3px]">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No properties yet</p>
            </div>
          ) : focusedProperty ? (
            <div ref={propertiesRef} className="relative w-full min-w-0 max-w-full px-[3px] pt-[2px] pb-[7px]">
              {showOnboardingDemoBanner && (
                <OnboardingDemoBanner
                  propertyId={focusedProperty.id}
                  className="mx-0 mb-2 max-sm:px-[12px] sm:mx-0"
                />
              )}
              <div className="w-full max-w-[247px]">
                <PropertyIdentityStrip
                  key={focusedProperty.id}
                  property={focusedProperty}
                  externalDashboard
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
            </div>
          ) : null}
        </div>
        )}
        </div>
      </div>

      {/* Calendar + hub summary — dashboard sits directly above the calendar */}
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-0 min-w-0 touch-pan-y overscroll-x-contain">
        {isHubHome && !propertiesLoading && properties.length > 0 && !focusedProperty ? (
          <div className="w-full min-w-0 max-w-full shrink-0 px-[3px] pb-2 pt-1">
            <HubSummaryPanel
              tasks={tasks}
              properties={properties}
              selectedPropertyIds={selectedPropertyIds}
              loading={tasksLoading}
              onOpenTasks={onFilterClick ? () => onFilterClick("show-tasks") : undefined}
              onOpenUrgentTasks={
                onFilterClick ? () => onFilterClick("show-tasks-urgent") : undefined
              }
              onOpenSpaces={onFilterClick ? () => onFilterClick("show-spaces") : undefined}
              onOpenAssets={onFilterClick ? () => onFilterClick("show-assets") : undefined}
              onDueSoon={onFilterClick ? () => onFilterClick("filter-date-this-week") : undefined}
              onOverdue={onFilterClick ? () => onFilterClick("filter-date-overdue") : undefined}
              onMissingInfo={
                onFilterClick ? () => onFilterClick("filter-task-missing-info") : undefined
              }
            />
          </div>
        ) : null}
        <div
          ref={calendarRef}
          className="flex-shrink-0 w-full min-w-0 max-w-full overflow-x-visible px-[3px]"
        >
          <div className="px-0 w-full min-w-0 max-w-[250px] overflow-x-visible">
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
                description="Pick a date to focus the task list in the middle. Use the property selector above to focus one building, or choose all properties to see everything at once."
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

