import { useState, useEffect, useMemo } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { MessageDetailPanel } from "@/components/messaging/MessageDetailPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Calendar as CalendarIcon, Cloud, CloudRain, Sun, CloudSun } from "lucide-react";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { format } from "date-fns";
import { useScheduleContext } from "@/contexts/ScheduleContext";

// Helper function to create gradient header style with multiply blend mode
const createGradientHeaderStyle = (color: string) => {
  // Paper background color (from design system: hsl(40, 20%, 94%) = #F1EEE8)
  // This matches exactly what bg-background uses in the right column
  const paperBg = "#F1EEE8";
  
  // Create gradient with multiply blend mode
  // Header is transparent, gradient overlays with multiply to darken/colorize the paper texture
  // Paper texture comes from parent container (bg-background class)
  return {
    backgroundColor: 'transparent',
    backgroundImage: `linear-gradient(to right, ${color} 0%, ${color} 20%, ${paperBg} 50%, ${paperBg} 100%)`,
    backgroundBlendMode: 'multiply',
    backgroundSize: '100%'
  };
};

// lg breakpoint is 1024px - use this for three-column layout
const LG_BREAKPOINT = 1024;

type SelectedItem = {
  type: 'task' | 'message';
  id: string;
} | null;

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const { selectedDate, setSelectedDateOrToday } = useScheduleContext();
  const [activeTab, setActiveTab] = useState<string>("tasks");
  const [filterToApply, setFilterToApply] = useState<string | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  
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
    
    tasks.forEach((task) => {
      const dueDateValue = task.due_date || task.due_at;
      
      if (dueDateValue && task.status !== 'completed' && task.status !== 'archived') {
        try {
          const date = new Date(dueDateValue);
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
          
          // Check if overdue
          date.setHours(0, 0, 0, 0);
          if (date < today) {
            current.overdue += 1;
            overdue += 1;
          }
          
          dateMap.set(dateKey, current);
        } catch {
          // Skip invalid dates
        }
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

  const handleTaskClick = (taskId: string) => {
    // Wide screen: selecting a task should auto-minimise the Create Task accordion
    // (on mobile, CreateTaskModal is a modal/drawer so this interaction doesn't apply)
    if (isLargeScreen) {
      setShowCreateTask(false);
    }
    setSelectedItem({ type: 'task', id: taskId });
  };

  const handleMessageClick = (messageId: string) => {
    setSelectedItem({ type: 'message', id: messageId });
  };

  const handleClosePanel = () => {
    setSelectedItem(null);
  };

  const handleOpenCreateTask = () => {
    setSelectedItem(null); // Close any open task detail
    setShowCreateTask(true); // Open create task (draft will be restored automatically if exists)
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDateOrToday(date);
    // Auto-switch to schedule tab when a date is selected
    if (date) {
      setActiveTab("schedule");
    }
  };

  const handleFilterClick = (filterId: string) => {
    // Set the filter to apply, which will trigger TaskList to apply it
    setFilterToApply(filterId);
    // Switch to tasks tab when filtering
    setActiveTab("tasks");
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

  // Render third column content - Create Task accordion + details below (lg+)
  const thirdColumnContent = isLargeScreen ? (
    <div className="flex flex-col gap-4">
      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        variant="column"
      />
      {selectedItem ? (
        selectedItem.type === 'task' ? (
          <TaskDetailPanel 
            taskId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="column"
          />
        ) : (
          <MessageDetailPanel 
            messageId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="column"
          />
        )
      ) : null}
    </div>
  ) : undefined;

  // Primary color for dashboard header (from design system: #8EC9CE)
  const primaryColor = "#8EC9CE";
  const headerStyle = createGradientHeaderStyle(primaryColor);

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <PageHeader>
        <div 
          className="mx-auto px-4 pt-[63px] pb-4 h-[115px] flex items-center justify-between max-w-full"
          style={headerStyle}
        >
          <div className="flex items-center gap-3 w-[303px]">
            <span className="shrink-0">
              <CalendarIcon className="h-6 w-6 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white leading-tight">Today</h1>
            </div>
            <div className="h-6 w-px bg-white/30 mx-2"></div>
            <div className="flex items-center gap-2 text-right">
              <WeatherIcon className="h-4 w-4 text-white/90" />
              <span className="text-sm text-white/90">
                {weather ? `${weather.temp}°C` : "--°C"}
              </span>
            </div>
          </div>
        </div>
      </PageHeader>
      
      <DualPaneLayout
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
            selectedPropertyIds={selectedPropertyIds}
            onCreateTask={handleOpenCreateTask}
          />
        }
        thirdColumn={thirdColumnContent}
      />
      
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
      
      {/* Create Task Modal - Modal variant for smaller screens */}
      {showCreateTask && !isLargeScreen && (
        <CreateTaskModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          variant="modal"
        />
      )}
    </div>
  );
}

