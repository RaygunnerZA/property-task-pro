import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { applyCalendarDisplayFilters, buildTasksByDate } from "@/lib/calendarDayMeta";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { PropertyIdentityStrip, type PropertyForStrip } from "@/components/properties/PropertyIdentityStrip";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import { OnboardingDemoBanner } from "@/components/onboarding/OnboardingDemoBanner";
import { propertyHasOnboardingDemoContent } from "@/lib/onboardingDemo";
import { useEnsureOnboardingDemo } from "@/hooks/useEnsureOnboardingDemo";
import { InstructionPanel, instructionPanelStorageKey } from "@/components/filla/InstructionPanel";
import { Button } from "@/components/ui/button";
import { PropertyDashboardCarousel } from "@/components/properties/PropertyDashboardCarousel";
import type { DashboardWorkbenchPanel } from "@/lib/propertyRoutes";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useDataContext } from "@/contexts/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";

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
  /** @deprecated Replaced by PropertySelectorStack in WorkbenchGradientHeader */
  scopeFilterBar?: ReactNode;
  workbenchPanel?: DashboardWorkbenchPanel;
}

/**
 * Left Column Component
 * Calendar + Properties
 * 
 * Desktop: Fixed side rail (~330px), sticky on scroll
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
  workbenchPanel = "home",
}: LeftColumnProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHubHome = pathname === "/" || pathname === "";
  const isScheduleWorkbench = workbenchPanel === "schedule";
  const isMobile = useIsMobile();
  const isScheduleMobile = isScheduleWorkbench && isMobile;
  const workbenchControls = useOptionalWorkbenchControls();
  const { userId } = useDataContext();
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
  const scheduleMobileInteractionRef = useRef<HTMLDivElement>(null);

  const propertyMap = useMemo(
    () => new Map(properties.map((p: { id: string }) => [p.id, p])),
    [properties]
  );

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

  const calendarTasks = useMemo(() => {
    let scoped = tasks;
    if (properties.length > 0 && !isAllPropertiesActive(selectedPropertyIds, ALL_PROPERTY_IDS)) {
      scoped = tasks.filter(
        (task) => task.property_id && selectedPropertyIds.has(task.property_id)
      );
    }
    if (isScheduleWorkbench && workbenchControls) {
      scoped = applyCalendarDisplayFilters(scoped, {
        searchQuery: workbenchControls.searchQuery,
        propertyMap,
        selectedWorkbenchFilters: workbenchControls.selectedFilters,
        userId,
      });
    }
    return scoped;
  }, [
    ALL_PROPERTY_IDS,
    isScheduleWorkbench,
    properties.length,
    propertyMap,
    selectedPropertyIds,
    tasks,
    userId,
    workbenchControls,
  ]);

  const scopedTasksByDate = useMemo(
    () => tasksByDate ?? buildTasksByDate(calendarTasks),
    [calendarTasks, tasksByDate]
  );

  const calendarAboveNavCards = Boolean(focusedProperty) && !isScheduleMobile;

  const miniCalendar = tasksLoading ? (
    <div className="w-full max-w-full rounded-lg bg-transparent px-0 pt-1 pb-1 pr-0 shadow-none">
      <Skeleton className="h-64 w-full" />
    </div>
  ) : (
    <div className="w-full max-w-full rounded-lg bg-transparent px-0 pt-1 pb-1 pr-0 shadow-none">
      <FillaMiniCalendar
        tasks={calendarTasks}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        tasksByDate={scopedTasksByDate}
        defaultExpanded={
          calendarAboveNavCards
            ? false
            : isScheduleMobile
              ? !selectedDate
              : !isHubHome
        }
        collapseOnDateSelect={isScheduleMobile}
      />
    </div>
  );

  return (
    <div 
      ref={leftColumnRef}
      className="flex h-auto w-full max-w-full flex-col overflow-y-auto px-0 sm:overflow-visible"
      style={{ backgroundColor: 'unset', background: 'unset', backgroundImage: 'none' }}
    >
      {/* Properties: selector stack + identity strip */}
      <div className="flex-shrink-0 w-full">
        <div className="sticky top-0 z-10 bg-background py-0 pl-0 pr-0">
        {scopeFilterBar}
        {!hideProperties && (
        <div
          className={cn(
            "px-0 w-full max-w-full overflow-x-visible",
            isScheduleWorkbench && "max-sm:hidden"
          )}
        >
          {propertiesLoading ? (
            <div className="space-y-3 px-[3px]">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No properties yet</p>
            </div>
          ) : isHubHome ? (
            <div ref={propertiesRef} className="relative w-full min-w-0 max-w-full rounded-none pl-0 pr-[2px] pt-0 pb-[3px]">
              <PropertyDashboardCarousel
                properties={properties as PropertyForStrip[]}
                tasks={tasks}
                loading={propertiesLoading || tasksLoading}
                selectedPropertyIds={selectedPropertyIds}
                urgentTaskCounts={urgentTaskCounts}
                onPropertySelectionChange={setSelectedPropertyIds}
                onFilterClick={onFilterClick}
              />
            </div>
          ) : focusedProperty ? (
            <div ref={propertiesRef} className="relative w-full min-w-0 max-w-full rounded-none pl-0 pr-[2px] pt-0 pb-[3px]">
              {showOnboardingDemoBanner && (
                <OnboardingDemoBanner
                  propertyId={focusedProperty.id}
                  className="mx-0 mb-2 max-sm:px-[12px] sm:mx-0"
                />
              )}
              <div className="w-full max-w-full">
                <PropertyIdentityStrip
                  key={focusedProperty.id}
                  property={focusedProperty}
                  externalDashboard
                  betweenSummaryAndNav={calendarAboveNavCards ? miniCalendar : undefined}
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
                />
              </div>
            </div>
          ) : null}
        </div>
        )}
        </div>
      </div>

      {/* Calendar below property carousel / when no single property is focused */}
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-0 min-w-0 touch-pan-y overscroll-x-contain">
      {calendarAboveNavCards ? null : (
      <div
        ref={calendarRef}
        className="flex-shrink-0 w-full min-w-0 max-w-full overflow-x-visible px-[3px]"
      >
        {isScheduleWorkbench ? (
          <div className="mb-2 hidden max-sm:block">
            <WorkbenchTaskFilterBar
              tasks={tasks}
              properties={properties}
              collapseInteractionRootRef={scheduleMobileInteractionRef}
            />
          </div>
        ) : null}
        <div
          ref={scheduleMobileInteractionRef}
          className="px-0 w-full min-w-0 max-w-full overflow-x-visible"
        >
          {miniCalendar}
        </div>
          {isHubHome && !workbenchTipDismissed && (
            <div className="mt-5 shrink-0 px-gutter-rail pb-4 sm:pr-2">
              <InstructionPanel
                id={WORKBENCH_OVERVIEW_TIP_ID}
                denseRail
                title="How this column works"
                description="Pick a date to focus the task list in the middle. Use the property selector in the header to focus one building, or choose all properties to see everything at once."
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
      )}
      </div>

      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />
    </div>
  );
}

