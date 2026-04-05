import { useState, useEffect, useMemo, useRef } from "react";
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
import { Cloud, CloudRain, Sun, CloudSun } from "lucide-react";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { format } from "date-fns";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import type { IntakeMode } from "@/types/intake";

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

type SelectedItem = {
  type: 'task' | 'message';
  id: string;
} | null;

type ExpandedSection = 'details' | 'assistant' | null;

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [workbenchIntakeMode, setWorkbenchIntakeMode] = useState<IntakeMode>("report_issue");
  const [modalInitialIntakeMode, setModalInitialIntakeMode] = useState<IntakeMode>("report_issue");
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const { isOpen: assistantOpen, closeAssistant, assistantContext, messages, proposedAction, loading, onSendMessage, onConfirmAction, onRejectAction } = useAssistantContext();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<string>("attention");
  const [filterToApply, setFilterToApply] = useState<string | null>(null);
  const [assistantFiltersToApply, setAssistantFiltersToApply] = useState<string[] | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const tabBeforeCreateTaskRef = useRef<string>("attention");
  const prevPropertySelectionRef = useRef<{ size: number; singleId: string | null }>({
    size: 0,
    singleId: null,
  });

  const queryClient = useQueryClient();

  // Fetch data once at the Dashboard level
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  const { weather } = useDailyBriefing();

  // Initialize selectedPropertyIds with all properties when properties load
  useEffect(() => {
    if (properties.length > 0 && selectedPropertyIds.size === 0) {
      setSelectedPropertyIds(new Set(properties.map(p => p.id)));
    }
  }, [properties, selectedPropertyIds.size]);

  // Single-property hub: open Attention when drilling into a property or switching which one is selected.
  useEffect(() => {
    const size = selectedPropertyIds.size;
    const singleId =
      size === 1 ? (Array.from(selectedPropertyIds)[0] as string | undefined) ?? null : null;
    const prev = prevPropertySelectionRef.current;
    let shouldReset = false;
    if (size === 1 && singleId) {
      if (prev.size === 1 && prev.singleId !== null && prev.singleId !== singleId) {
        shouldReset = true;
      } else if (prev.size !== 1) {
        shouldReset = true;
      }
    }
    prevPropertySelectionRef.current = { size, singleId };
    if (shouldReset) {
      setActiveTab("attention");
    }
  }, [selectedPropertyIds]);

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

  /** Matches former DailyBriefingCard subtitle: all properties vs selected subset (hidden when only one property). */
  const dashboardPropertyScopeTitle = useMemo(() => {
    if (properties.length <= 1) return null;
    const ids = selectedPropertyIds;
    if (!ids || ids.size === 0 || ids.size === properties.length) {
      return "All Properties";
    }
    const labels = properties
      .filter((p) => ids.has(p.id))
      .map((p) => p.nickname || p.address);
    return labels.length > 0 ? labels.join(" | ") : null;
  }, [properties, selectedPropertyIds]);

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
      setActiveTab("tasks");
      window.setTimeout(() => setAssistantFiltersToApply(null), 100);
    };
    window.addEventListener("filla:assistant-apply-task-filters", onApplyFilters);
    return () => window.removeEventListener("filla:assistant-apply-task-filters", onApplyFilters);
  }, []);

  useEffect(() => {
    const onOpenTask = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId?: string }>;
      const taskId = customEvent.detail?.taskId;
      if (!taskId) return;

      setActiveTab("tasks");
      setSelectedItem({ type: "task", id: taskId });
      if (isLargeScreen) setExpandedSection("details");
    };

    window.addEventListener("filla:assistant-open-task", onOpenTask);
    return () => window.removeEventListener("filla:assistant-open-task", onOpenTask);
  }, [isLargeScreen]);

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
      setActiveTab(tabBeforeCreateTaskRef.current); // Return to the tab user was on
    }
  };

  const handleTaskCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setActiveTab(tabBeforeCreateTaskRef.current); // Stay on / return to same tab after creating
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
      setActiveTab("schedule");
    }
  };

  const handleFilterClick = (filterId: string) => {
    // Switch to tasks tab for any property/filter interaction.
    setActiveTab("tasks");
    // "show-tasks" is a tab-switch signal only (no filter mutation).
    if (filterId === "show-tasks") return;
    // Set the filter to apply, which will trigger TaskList to apply it.
    setFilterToApply(filterId);
    // Reset filterToApply after a brief moment to allow the filter to be toggled again
    setTimeout(() => setFilterToApply(null), 100);
  };

  // Get weather icon based on condition code
  const getWeatherIcon = (conditionCode: number | null) => {
    if (!conditionCode) return Cloud;
    
    // WMO Weather interpretation codes (simplified)
    // 0: Clear sky, 1-3: Mainly clear/partly cloudy, 45-48: Fog
    // 51-67: Drizzle/Rain, 71-77: Snow, 80-99: Rain showers/Thunderstorm
    if (conditionCode === 0) return Sun;
    if (conditionCode >= 1 && conditionCode <= 3) return CloudSun;
    if (conditionCode >= 51 && conditionCode <= 67) return CloudRain;
    if (conditionCode >= 80 && conditionCode <= 99) return CloudRain;
    return Cloud;
  };

  const WeatherIcon = weather ? getWeatherIcon(weather.conditionCode) : Cloud;

  const selectedTaskId = selectedItem?.type === "task" ? selectedItem.id : null;
  const detailsSectionTitle = selectedTaskId ? "Task Details" : "Details";

  const intakeScopedPropertyId = useMemo(() => {
    if (selectedPropertyIds.size !== 1) return undefined;
    return Array.from(selectedPropertyIds)[0];
  }, [selectedPropertyIds]);

  const thirdColumnContent = isLargeScreen ? (
    <div className="flex flex-col pt-4 pr-2 pb-0 pl-2">
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
    <PageHeader>
      <div
        className="pl-[18px] pr-4 pt-[18px] pb-[12px] h-[100px] flex items-end justify-start rounded-bl-[12px]"
        style={headerStyle}
      >
        <div className="flex flex-col items-start justify-center gap-1 w-[248px] min-w-0 shrink-0">
          {dashboardPropertyScopeTitle ? (
            <p
              className="text-[34px] font-normal text-transparent leading-tight truncate max-w-full text-shadow-neu-pressed bg-[linear-gradient(0deg,rgba(255,255,255,0.46)_0%,rgba(255,255,255,0.64)_100%)] bg-clip-text"
              title={dashboardPropertyScopeTitle}
            >
              {dashboardPropertyScopeTitle}
            </p>
          ) : null}
          <div className="flex items-center justify-start gap-[7px] w-[248px] min-w-0">
            <h1 className="text-[18px] font-semibold text-white leading-tight shrink-0">Today</h1>
            <div className="h-6 w-px bg-white/30 mx-2 shrink-0" />
            <div className="flex items-center justify-start gap-2 text-left">
              <WeatherIcon className="h-4 w-4 text-white/90 shrink-0" />
              <span className="text-sm text-white/90 whitespace-nowrap">
                {weather ? `${weather.temp}°C` : "--°C"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PageHeader>
  );

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
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
            onPropertySelectionChange={setSelectedPropertyIds}
            onOpenIntake={handleOpenIntake}
            onTaskClick={handleTaskClick}
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
            onTabChange={setActiveTab}
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

