import { useState, useEffect, useMemo } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { MessageDetailPanel } from "@/components/messaging/MessageDetailPanel";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Calendar as CalendarIcon } from "lucide-react";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { format } from "date-fns";

// lg breakpoint is 1024px - use this for three-column layout
const LG_BREAKPOINT = 1024;

type SelectedItem = {
  type: 'task' | 'message';
  id: string;
} | null;

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<string>("tasks");
  
  // Fetch data once at the Dashboard level
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();

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
    setSelectedItem({ type: 'task', id: taskId });
  };

  const handleMessageClick = (messageId: string) => {
    setSelectedItem({ type: 'message', id: messageId });
  };

  const handleClosePanel = () => {
    setSelectedItem(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    // Auto-switch to schedule tab when a date is selected
    if (date) {
      setActiveTab("schedule");
    }
  };

  // Render third column content - only when item is selected on large screens
  const thirdColumnContent = isLargeScreen && selectedItem ? (
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
  ) : undefined;

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <PageHeader>
        <div className="mx-auto px-4 pt-[50px] pb-4 flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3">
            <span className="icon-primary shrink-0">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground leading-tight">Today</h1>
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
    </div>
  );
}

