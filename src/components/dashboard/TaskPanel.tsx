import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskList } from "@/components/tasks/TaskList";
import MessageList from "@/components/MessageList";
import TaskCard from "@/components/TaskCard";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { CheckSquare, Inbox, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isAfter, startOfDay } from "date-fns";
import EmptyState from "@/components/EmptyState";

interface TaskPanelProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  selectedItem?: { type: 'task' | 'message'; id: string } | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedDate?: Date | undefined;
  filterToApply?: string | null;
}

/**
 * Task Panel Component
 * 
 * Desktop Right Column Task Panel with 3 tabs:
 * - Tasks: Full task list
 * - Inbox: Inbox items placeholder
 * - Schedule: Upcoming agenda
 * 
 * Features:
 * - 100% height container
 * - Sticky tab bar
 * - Scrollable content area
 * - Neomorphic tab styling (E2 elevation for active, inset for track)
 * - Paper texture background
 */
export function TaskPanel({ 
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick, 
  onMessageClick, 
  selectedItem,
  activeTab: externalActiveTab,
  onTabChange,
  selectedDate,
  filterToApply
}: TaskPanelProps = {}) {
  const navigate = useNavigate();
  const [internalActiveTab, setInternalActiveTab] = useState("tasks");
  
  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Filter tasks for Schedule tab - by selectedDate if provided, otherwise upcoming
  const scheduleTasks = useMemo(() => {
    if (selectedDate) {
      // Filter by selected date
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      return tasks
        .filter((task) => {
          if (!task.due_date) return false;
          if (task.status === "completed") return false;
          try {
            const taskDateStr = format(new Date(task.due_date), "yyyy-MM-dd");
            return taskDateStr === selectedDateStr;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          // Sort by time if available, otherwise by creation date
          const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
          return aTime - bTime;
        });
    } else {
      // Show upcoming tasks
      const today = startOfDay(new Date());
      return tasks
        .filter((task) => {
          if (!task.due_date) return false;
          if (task.status === "completed") return false;
          try {
            const dueDate = startOfDay(new Date(task.due_date));
            return isAfter(dueDate, today) || dueDate.getTime() === today.getTime();
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          if (!a.due_date || !b.due_date) return 0;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 10); // Limit to 10 upcoming tasks
    }
  }, [tasks, selectedDate]);

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col pt-[18px] pb-[18px]">
        {/* Sticky Tab Bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50 ml-[14px] mr-[14px]">
          <TabsList
            className={cn(
              "w-full grid grid-cols-3 h-12 py-1 px-2 rounded-[15px] bg-transparent",
              "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]"
            )}
          >
            <TabsTrigger
              value="tasks"
              className={cn(
                "rounded-[5px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="inbox"
              className={cn(
                "rounded-[5px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
            >
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className={cn(
                "rounded-[5px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-0 h-full pt-[8px] px-4 pb-4">
            <TaskList 
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              onTaskClick={onTaskClick}
              selectedTaskId={selectedItem?.type === 'task' ? selectedItem.id : undefined}
              filterToApply={filterToApply}
            />
          </TabsContent>

          {/* Inbox Tab */}
          <TabsContent value="inbox" className="mt-0 h-full p-4">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inbox
              </h3>
              <MessageList 
                onMessageClick={onMessageClick}
                selectedMessageId={selectedItem?.type === 'message' ? selectedItem.id : undefined}
              />
            </div>
          </TabsContent>

          {/* Schedule Tab - Timeline View */}
          <TabsContent value="schedule" className="mt-0 h-full p-0">
            {tasksLoading ? (
              <div className="p-4 space-y-3">
                <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
              </div>
            ) : (
              <ScheduleView
                tasks={scheduleTasks}
                properties={properties}
                selectedDate={selectedDate}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedItem?.type === 'task' ? selectedItem.id : undefined}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

