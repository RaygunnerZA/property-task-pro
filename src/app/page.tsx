import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { MessageDetailPanel } from "@/components/messaging/MessageDetailPanel";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { PageHeader } from "@/components/design-system/PageHeader";
import { getWeatherLucideIcon } from "@/lib/weatherIcon";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { format } from "date-fns";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import type { IntakeMode } from "@/types/intake";
import { WORKBENCH_PANEL_TAB_QUERY } from "@/lib/propertyRoutes";
import { PropertyScopeFilterBar } from "@/components/properties/PropertyScopeFilterBar";

// Helper function to create gradient header style
const createGradientHeaderStyle = (color: string) => {
  // Create gradient: color solid until 28%, then transition to transparent by 97%
  // No texture overlay - allows clean blend with bg-background
  return {
    backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} 28%, transparent 97%, transparent 100%)`
  };
};

// Match DualPaneLayout third-column breakpoint (min-1380px)
const LG_BREAKPOINT = 1380;

const VALID_WORKBENCH_PANEL_TABS = new Set(["attention", "tasks", "compliance", "schedule"]);

/** Use the live address bar when mutating query params so we never drop `property` or revert scope if React's `searchParams` is one frame behind (e.g. Hall selected then Compliance tab immediately). */
function workbenchSearchParamsFromBrowser(fallback: URLSearchParams): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams(fallback);
  }
  return new URLSearchParams(window.location.search);
}

type SelectedItem = {
  type: 'task' | 'message';
  id: string;
} | null;

type ExpandedSection = 'details' | 'assistant' | null;

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [workbenchIntakeMode, setWorkbenchIntakeMode] = useState<IntakeMode>("report_issue");
  const [modalInitialIntakeMode, setModalInitialIntakeMode] = useState<IntakeMode>("report_issue");
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const { isOpen: assistantOpen, closeAssistant, assistantContext, messages, proposedAction, loading, onSendMessage, onConfirmAction, onRejectAction } = useAssistantContext();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterToApply, setFilterToApply] = useState<string | null>(null);
  const [assistantFiltersToApply, setAssistantFiltersToApply] = useState<string[] | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const tabBeforeCreateTaskRef = useRef<string>("attention");
  const prevSearchStringRef = useRef<string | undefined>(undefined);
  const workbenchPropertyInitRef = useRef(false);
  const prevWorkbenchPropertyIdRef = useRef<string | null | undefined>(undefined);
  /** User chose ALL (multi-org); URL may still show ?property= for a frame — don't collapse selection until URL clears. */
  const pendingPropertyParamClearRef = useRef(false);

  const queryClient = useQueryClient();

  // Fetch data once at the Dashboard level
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  const { weather } = useDailyBriefing();

  // URL ↔ selection: ?property=id opens the single-property workbench; clearing the param (e.g. Hub) widens to all.
  useEffect(() => {
    if (properties.length === 0) return;
    const curSearch = searchParams.toString();
    const prevSearch = prevSearchStringRef.current;
    prevSearchStringRef.current = curSearch;

    const pid = searchParams.get("property");
    const allIds = properties.map((p) => p.id);

    // One-property org: "all properties" is still that single id — keep ?property= so sidebar
    // (Compliance, Documents, …) and shared links stay scoped to the hub property.
    if (!pid && allIds.length === 1) {
      const next = new URLSearchParams(searchParams);
      next.set("property", allIds[0]);
      setSearchParams(next, { replace: true });
      return;
    }

    if (pid) {
      if (properties.some((p) => p.id === pid)) {
        setSelectedPropertyIds((prev) => {
          const skipStaleUrlWhileClearing =
            pendingPropertyParamClearRef.current && isAllPropertiesActive(prev, allIds);
          if (skipStaleUrlWhileClearing) {
            return prev;
          }
          const skipMulti = prev.size > 1 && !isAllPropertiesActive(prev, allIds);
          if (skipMulti) {
            return prev;
          }
          return new Set([pid]);
        });
      } else {
        const next = new URLSearchParams(searchParams);
        next.delete("property");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    pendingPropertyParamClearRef.current = false;

    if (
      prevSearch !== undefined &&
      prevSearch.includes("property=") &&
      !curSearch.includes("property=")
    ) {
      setSelectedPropertyIds(new Set(allIds));
      return;
    }

    setSelectedPropertyIds((prev) =>
      prev.size === 0 ? new Set(allIds) : prev
    );
  }, [properties, searchParams, setSearchParams]);

  const handlePropertySelectionChange = useCallback(
    (next: Set<string>) => {
      setSelectedPropertyIds(next);
      if (properties.length === 0) return;
      const allIds = properties.map((p) => p.id);
      if (isAllPropertiesActive(next, allIds) && allIds.length > 1) {
        pendingPropertyParamClearRef.current = true;
      } else {
        pendingPropertyParamClearRef.current = false;
      }
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_PANEL_TAB_QUERY);
      if (next.size === 1) {
        params.set("property", Array.from(next)[0]);
        setSearchParams(params, { replace: true });
      } else if (isAllPropertiesActive(next, allIds)) {
        if (allIds.length === 1) {
          params.set("property", allIds[0]);
        } else {
          params.delete("property");
        }
        setSearchParams(params, { replace: true });
      } else {
        setSearchParams(params, { replace: true });
      }
    },
    [properties, searchParams, setSearchParams]
  );

  /** Single source of truth with the URL: no `panelTab` ⇒ Attention. */
  const activeTab = useMemo(() => {
    const t = searchParams.get(WORKBENCH_PANEL_TAB_QUERY);
    if (t && VALID_WORKBENCH_PANEL_TABS.has(t)) return t;
    return "attention";
  }, [searchParams]);

  const handleWorkbenchTabChange = useCallback(
    (tab: string) => {
      const params = workbenchSearchParamsFromBrowser(searchParams);
      if (tab === "attention") {
        params.delete(WORKBENCH_PANEL_TAB_QUERY);
      } else {
        params.set(WORKBENCH_PANEL_TAB_QUERY, tab);
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // When the workbench `property` param changes after load, default to Attention (strip stale panelTab).
  // Skip the first transition that only injects `property` for single-property orgs so deep links keep ?panelTab=.
  useEffect(() => {
    if (properties.length === 0) return;
    const pid = searchParams.get("property");
    if (!workbenchPropertyInitRef.current) {
      workbenchPropertyInitRef.current = true;
      prevWorkbenchPropertyIdRef.current = pid;
      return;
    }
    const prev = prevWorkbenchPropertyIdRef.current;
    if (pid === prev) return;
    prevWorkbenchPropertyIdRef.current = pid;
    const singleId = properties.length === 1 ? properties[0].id : null;
    const isImplicitSingleOrgFill =
      singleId != null && (prev == null || prev === "") && pid === singleId;
    if (isImplicitSingleOrgFill) return;
    const params = new URLSearchParams(searchParams);
    if (!params.has(WORKBENCH_PANEL_TAB_QUERY)) return;
    params.delete(WORKBENCH_PANEL_TAB_QUERY);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, properties]);

  // Centralized aggregation: Calculate stats once at Dashboard level
  const { tasksByDate, urgentCount, overdueCount } = useMemo(() => {
    const dateMap = new Map<string, {
      total: number;
      high: number;
      urgent: number;
      overdue: number;
    }>();
    
    let urgent = 0;
    let overdue = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Normalize priority helper
    const normalizePriority = (priority: string | null | undefined): string => {
      if (!priority) return 'normal';
      const normalized = priority.toLowerCase();
      if (normalized === 'medium') return 'normal';
      return normalized;
    };
    
    const addDateEntry = (dateValue: string, task: any) => {
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return;
        const dateKey = format(date, "yyyy-MM-dd");
        const current = dateMap.get(dateKey) || { total: 0, high: 0, urgent: 0, overdue: 0 };
        
        current.total += 1;
        
        const priority = normalizePriority(task.priority);
        
        if (priority === 'high') {
          current.high += 1;
        } else if (priority === 'urgent') {
          current.urgent += 1;
          urgent += 1;
        }
        
        date.setHours(0, 0, 0, 0);
        if (date < today) {
          current.overdue += 1;
          overdue += 1;
        }
        
        dateMap.set(dateKey, current);
      } catch {
        // Skip invalid dates
      }
    };

    tasks.forEach((task) => {
      if (task.status === 'completed' || task.status === 'archived') return;

      const dueDateValue = task.due_date || task.due_at;
      if (dueDateValue) addDateEntry(dueDateValue, task);

      // Include milestone dates on the calendar
      const milestones = (task as any).milestones;
      if (Array.isArray(milestones)) {
        milestones.forEach((m: any) => {
          if (m?.dateTime) addDateEntry(m.dateTime, task);
        });
      }
    });
    
    return {
      tasksByDate: dateMap,
      urgentCount: urgent,
      overdueCount: overdue,
    };
  }, [tasks]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= LG_BREAKPOINT);
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Sync concertina with AssistantContext: when openAssistant is called, expand assistant section
  useEffect(() => {
    if (assistantOpen && isLargeScreen) {
      setExpandedSection('assistant');
    }
  }, [assistantOpen, isLargeScreen]);

  // When transitioning from large to small screen, close any auto-opened create modal
  useEffect(() => {
    if (!isLargeScreen) setShowCreateTask(false);
  }, [isLargeScreen]);

  useEffect(() => {
    const onApplyFilters = (event: Event) => {
      const customEvent = event as CustomEvent<{ filterIds?: string[] }>;
      const filterIds = Array.isArray(customEvent.detail?.filterIds)
        ? customEvent.detail.filterIds
        : [];
      setAssistantFiltersToApply(filterIds);
      handleWorkbenchTabChange("tasks");
      window.setTimeout(() => setAssistantFiltersToApply(null), 100);
    };
    window.addEventListener("filla:assistant-apply-task-filters", onApplyFilters);
    return () => window.removeEventListener("filla:assistant-apply-task-filters", onApplyFilters);
  }, [handleWorkbenchTabChange]);

  useEffect(() => {
    const onOpenTask = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId?: string }>;
      const taskId = customEvent.detail?.taskId;
      if (!taskId) return;

      handleWorkbenchTabChange("tasks");
      setSelectedItem({ type: "task", id: taskId });
      if (isLargeScreen) setExpandedSection("details");
    };

    window.addEventListener("filla:assistant-open-task", onOpenTask);
    return () => window.removeEventListener("filla:assistant-open-task", onOpenTask);
  }, [isLargeScreen, handleWorkbenchTabChange]);

  const handleTaskClick = (taskId: string) => {
    if (isLargeScreen) {
      setExpandedSection('details');
    }
    setSelectedItem({ type: 'task', id: taskId });
  };

  const handleOpenIntake = (mode: IntakeMode = "report_issue") => {
    tabBeforeCreateTaskRef.current = activeTab;
    if (isLargeScreen) {
      setWorkbenchIntakeMode(mode);
      setExpandedSection(null);
      return;
    }
    setModalInitialIntakeMode(mode);
    setShowCreateTask(true);
  };

  const handleCreateTaskOpenChange = (open: boolean) => {
    setShowCreateTask(open);
    if (!open) {
      handleWorkbenchTabChange(tabBeforeCreateTaskRef.current);
    }
  };

  const handleTaskCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    handleWorkbenchTabChange(tabBeforeCreateTaskRef.current);
  };

  const handleMessageClick = (messageId: string) => {
    if (isLargeScreen) {
      // Keep the last selected task active on desktop workbench.
      return;
    }
    setSelectedItem({ type: 'message', id: messageId });
  };

  const handleClosePanel = () => {
    if (isLargeScreen) {
      setExpandedSection((section) => (section === "details" ? null : section));
      return;
    }
    setSelectedItem(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    // Auto-switch to schedule tab when a date is selected
    if (date) {
      handleWorkbenchTabChange("schedule");
    }
  };

  const handleFilterClick = (filterId: string) => {
    // Switch to tasks tab for any property/filter interaction.
    handleWorkbenchTabChange("tasks");
    // "show-tasks" is a tab-switch signal only (no filter mutation).
    if (filterId === "show-tasks") return;
    // Set the filter to apply, which will trigger TaskList to apply it.
    setFilterToApply(filterId);
    // Reset filterToApply after a brief moment to allow the filter to be toggled again
    setTimeout(() => setFilterToApply(null), 100);
  };

  const WeatherIcon = getWeatherLucideIcon(weather?.conditionCode ?? null);

  /** Single-property workbench: Today + weather live on the property card thumbnail instead of the gradient header. */
  const showTodayWeatherOnPropertyCard = selectedPropertyIds.size === 1;

  const selectedTaskId = selectedItem?.type === "task" ? selectedItem.id : null;
  const detailsSectionTitle = selectedTaskId ? "Task Details" : "Details";

  const intakeScopedPropertyId = useMemo(() => {
    if (selectedPropertyIds.size !== 1) return undefined;
    return Array.from(selectedPropertyIds)[0];
  }, [selectedPropertyIds]);

  const thirdColumnContent = isLargeScreen ? (
    <div className="flex flex-col pt-3 pr-2 pb-0 pl-2">
      <div className="pb-[20px]">
        <IntakeModal
          open={true}
          onOpenChange={() => undefined}
          onTaskCreated={handleTaskCreated}
          defaultPropertyId={intakeScopedPropertyId}
          variant="column"
          headless
          intakeMode={workbenchIntakeMode}
          onIntakeModeChange={setWorkbenchIntakeMode}
        />
      </div>
      <ThirdColumnConcertina
        sections={[
          ...(selectedTaskId
            ? [{
                id: 'details',
                title: detailsSectionTitle,
                isExpanded: expandedSection === 'details',
                onToggle: () => setExpandedSection((s) => (s === 'details' ? null : 'details')),
                children: (
                  <TaskDetailPanel
                    taskId={selectedTaskId}
                    onClose={handleClosePanel}
                    variant="column"
                  />
                ),
              }]
            : []),
          {
            id: 'assistant',
            title: 'Filla AI',
            isExpanded: expandedSection === 'assistant',
            onToggle: () => {
              setExpandedSection((s) => {
                if (s === 'assistant') {
                  closeAssistant();
                  return null;
                }
                return 'assistant';
              });
            },
            children: (
              <AssistantPanelBody
                context={assistantContext}
                messages={messages}
                proposedAction={proposedAction}
                loading={loading}
                onSendMessage={onSendMessage}
                onConfirmAction={onConfirmAction}
                onRejectAction={onRejectAction}
                showContextHeader={true}
                className="min-h-[200px]"
              />
            ),
          },
        ]}
      />
    </div>
  ) : undefined;

  // Primary color for dashboard header (from design system: #8EC9CE); single-property filter uses that property's colour
  const primaryColor = "#8EC9CE";
  const headerAccentColor = useMemo(() => {
    const ids = properties.map((p) => p.id);
    if (
      properties.length <= 1 ||
      isAllPropertiesActive(selectedPropertyIds, ids) ||
      selectedPropertyIds.size !== 1
    ) {
      return primaryColor;
    }
    const onlyId = Array.from(selectedPropertyIds)[0];
    const p = properties.find((x) => x.id === onlyId) as
      | { icon_color_hex?: string | null }
      | undefined;
    const hex = p?.icon_color_hex?.trim();
    return hex || primaryColor;
  }, [properties, selectedPropertyIds, primaryColor]);

  const headerStyle = createGradientHeaderStyle(headerAccentColor);

  // Header element that will be passed to DualPaneLayout
  const headerElement = (
    <PageHeader showAccountMenu={false}>
      <div
        className="flex h-[60px] items-end justify-start rounded-bl-[12px] pb-[12px] pl-[18px] pr-28 pt-[18px] sm:pr-40"
        style={headerStyle}
      >
        {!showTodayWeatherOnPropertyCard ? (
          <div className="flex items-center justify-start gap-[7px] w-[248px] min-w-0 shrink-0">
            <h1 className="text-[18px] font-semibold text-white leading-tight shrink-0">Today</h1>
            <div className="h-6 w-px bg-white/30 mx-2 shrink-0" />
            <div className="flex items-center justify-start gap-2 text-left">
              <WeatherIcon className="h-4 w-4 text-white/90 shrink-0" />
              <span className="text-sm text-white/90 whitespace-nowrap">
                {weather ? `${weather.temp}°C` : "--°C"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </PageHeader>
  );

  return (
    <div className="dashboard-workbench min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <DualPaneLayout
        header={headerElement}
        leftColumn={
          <LeftColumn 
            tasks={tasks}
            properties={properties}
            tasksLoading={tasksLoading}
            propertiesLoading={propertiesLoading}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            tasksByDate={tasksByDate}
            urgentCount={urgentCount}
            overdueCount={overdueCount}
            onFilterClick={handleFilterClick}
            selectedPropertyIds={selectedPropertyIds}
            onPropertySelectionChange={handlePropertySelectionChange}
            onOpenIntake={handleOpenIntake}
            propertyCardWeather={showTodayWeatherOnPropertyCard ? weather : undefined}
            scopeFilterBar={
              <PropertyScopeFilterBar
                variant="primary"
                placement="leftColumn"
                properties={properties}
                selectedPropertyIds={selectedPropertyIds}
                onSelectionChange={handlePropertySelectionChange}
                onFilterClick={handleFilterClick}
              />
            }
          />
        }
        rightColumn={
          <RightColumn 
            tasks={tasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={handleTaskClick}
            onMessageClick={handleMessageClick}
            selectedItem={selectedItem}
            activeTab={activeTab}
            onTabChange={handleWorkbenchTabChange}
            selectedDate={selectedDate}
            filterToApply={filterToApply}
            filtersToApply={assistantFiltersToApply}
            selectedPropertyIds={selectedPropertyIds}
            onOpenIntake={handleOpenIntake}
          />
        }
        thirdColumn={thirdColumnContent}
      />
      
      {/* Universal Intake Modal - primary entry on smaller layouts */}
      {showCreateTask && !isLargeScreen && (
        <IntakeModal
          open={showCreateTask}
          onOpenChange={handleCreateTaskOpenChange}
          onTaskCreated={handleTaskCreated}
          defaultPropertyId={intakeScopedPropertyId}
          initialIntakeMode={modalInitialIntakeMode}
        />
      )}

      {/* Detail Panel - Modal variant for smaller screens */}
      {selectedItem && !isLargeScreen && (
        selectedItem.type === 'task' ? (
          <TaskDetailPanel 
            taskId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="modal"
          />
        ) : (
          <MessageDetailPanel 
            messageId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="modal"
          />
        )
      )}
    </div>
  );
}

