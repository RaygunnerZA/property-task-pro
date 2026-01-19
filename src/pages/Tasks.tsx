import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, CheckSquare } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { PageHeader } from "@/components/design-system/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useScheduleContext } from "@/contexts/ScheduleContext";
import { format } from "date-fns";

const Tasks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("tasks");
  const { selectedDate } = useScheduleContext();

  // Fetch data
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();

  // Calculate stats like dashboard
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

  // Check screen size for third column
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Check for ?add=true in URL to open modal
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowCreateTask(true);
      // Remove the query param from URL
      navigate('/tasks', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTaskCreated = (taskId: string) => {
    // Invalidate tasks query to refresh
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setShowCreateTask(false);
  };

  const handleTaskClick = (taskId: string) => {
    // Wide screen: selecting a task should auto-minimise the Create Task accordion
    if (isLargeScreen) {
      setShowCreateTask(false);
    }
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  const handleOpenCreateTask = () => {
    setShowCreateTask(true);
    setSelectedTaskId(null);
  };

  // Render third column content
  const thirdColumnContent = isLargeScreen ? (
    <div className="flex flex-col gap-4">
      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        variant="column"
        onTaskCreated={handleTaskCreated}
      />
      {selectedTaskId ? (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="column"
        />
      ) : null}
    </div>
  ) : undefined;

  // Primary color for header (from design system: #8EC9CE)
  const primaryColor = "#8EC9CE";
  // Paper background color - EXACT match to right column bg-background
  const paperBg = "#F1EEE8";
  const headerStyle = {
    backgroundColor: 'transparent',
    // Gradient with multiply blend mode overlays the paper texture from parent
    backgroundImage: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} 20%, ${paperBg} 50%, ${paperBg} 100%)`,
    backgroundBlendMode: 'multiply',
    backgroundSize: '100%'
  };

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <PageHeader>
        <div 
          className="mx-auto px-4 pt-[63px] pb-4 h-[115px] flex items-center justify-between max-w-full"
          style={headerStyle}
        >
          <div className="flex items-center gap-3">
            <CheckSquare className="h-6 w-6 text-white" />
            <h1 className="text-2xl font-semibold text-white leading-tight">My Tasks</h1>
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
            selectedItem={selectedTaskId ? { type: 'task', id: selectedTaskId } : null}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedDate={selectedDate}
            onCreateTask={handleOpenCreateTask}
          />
        }
        thirdColumn={thirdColumnContent}
      />
      
      {/* Modal variant for smaller screens */}
      {showCreateTask && !isLargeScreen && (
        <CreateTaskModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          variant="modal"
          onTaskCreated={handleTaskCreated}
        />
      )}
      
      {selectedTaskId && !isLargeScreen && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </div>
  );
};

export default Tasks;
