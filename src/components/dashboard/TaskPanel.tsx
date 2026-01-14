import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from "@/components/ui/animated-tabs";
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

  // Get unscheduled tasks (no due_date) for backlog section
  const unscheduledTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date && !task.due_at) {
        if (task.status === "completed" || task.status === "archived") return false;
        return true;
      }
      return false;
    });
  }, [tasks]);

  // Filter tasks for Schedule tab - by selectedDate if provided, otherwise upcoming
  const scheduleTasks = useMemo(() => {
    // #region agent log
    const tasksWithDueDate = tasks.filter(t => t.due_date).length;
    const tasksWithoutDueDate = tasks.length - tasksWithDueDate;
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'TaskPanel.tsx:66',message:'scheduleTasks filter start',data:{tasksCount:tasks.length,tasksWithDueDate,tasksWithoutDueDate,selectedDate:selectedDate?.toISOString()||null,activeTab},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (selectedDate) {
      // Filter by selected date - normalize both dates to start of day for accurate comparison
      const selectedDateNormalized = startOfDay(selectedDate);
      const selectedDateStr = format(selectedDateNormalized, "yyyy-MM-dd");
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'TaskPanel.tsx:72',message:'Filtering by selected date',data:{selectedDateStr,selectedDateISO:selectedDate.toISOString(),tasksWithDueDate},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return tasks
        .filter((task) => {
          if (!task.due_date) return false;
          if (task.status === "completed" || task.status === "archived") return false;
          try {
            // Normalize task due_date to start of day for comparison
            const taskDateNormalized = startOfDay(new Date(task.due_date));
            const taskDateStr = format(taskDateNormalized, "yyyy-MM-dd");
            const matches = taskDateStr === selectedDateStr;
            // #region agent log
            if (task.due_date && !matches) {
              fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'TaskPanel.tsx:81',message:'Task date mismatch',data:{taskId:task.id,taskDueDate:task.due_date,taskDateStr,selectedDateStr},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            return matches;
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'TaskPanel.tsx:88',message:'Task date parsing error',data:{taskId:task.id,taskDueDate:task.due_date,error:error instanceof Error?error.message:String(error)},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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
          if (task.status === "completed" || task.status === "archived") return false;
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

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'TaskPanel.tsx:107',message:'scheduleTasks result',data:{resultCount:scheduleTasks.length,firstTask:scheduleTasks[0]||null,selectedDate:selectedDate?.toISOString()||null},timestamp:Date.now()})}).catch(()=>{});
  }, [scheduleTasks, selectedDate]);
  // #endregion

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col pt-[18px] pb-[18px]">
        {/* Sticky Tab Bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50 ml-[14px] mr-[14px] flex md:justify-start">
          <TabsList
            className={cn(
              "w-full md:w-[373px] grid md:flex grid-cols-3 h-12 py-1 pl-0 pr-0 gap-1.5 rounded-[15px] bg-transparent",
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
              style={{ paddingLeft: '26px', paddingRight: '26px' }}
            >
              <CheckSquare className="h-4 w-4" style={{ marginRight: '2px', marginLeft: '-10px', width: '31px' }} />
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
              style={{ paddingLeft: '24px', paddingRight: '24px' }}
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
              style={{ paddingLeft: '24px', paddingRight: '24px' }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <TabsContents>
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
              {/* #region agent log */}
              {activeTab === 'schedule' && fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'F',location:'TaskPanel.tsx:194',message:'Schedule tab rendering',data:{tasksLoading,scheduleTasksCount:scheduleTasks.length,selectedDate:selectedDate?.toISOString()||null},timestamp:Date.now()})}).catch(()=>{}) && null}
              {/* #endregion */}
              {tasksLoading ? (
                <div className="p-4 space-y-3">
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {scheduleTasks.length > 0 ? (
                    <ScheduleView
                      tasks={scheduleTasks}
                      properties={properties}
                      selectedDate={selectedDate}
                      onTaskClick={onTaskClick}
                      selectedTaskId={selectedItem?.type === 'task' ? selectedItem.id : undefined}
                    />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center flex-1 min-h-[200px] text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {selectedDate 
                          ? `No tasks scheduled for ${format(selectedDate, "EEEE, MMMM d")}`
                          : "No upcoming tasks"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDate 
                          ? "Try selecting a different date or create a new task"
                          : "Create a task with a due date to see it here"}
                      </p>
                    </div>
                  )}
                  
                  {/* Unscheduled Tasks Section */}
                  {unscheduledTasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="px-4 mb-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Unscheduled ({unscheduledTasks.length})
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tasks without a due date
                        </p>
                      </div>
                      <div className="space-y-2 px-4 pb-4">
                        {unscheduledTasks.slice(0, 5).map((task) => {
                          const property = task.property_id ? propertyMap.get(task.property_id) : undefined;
                          return (
                            <div
                              key={task.id}
                              onClick={() => onTaskClick?.(task.id)}
                              className="p-3 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border/50"
                            >
                              <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">
                                {task.title}
                              </p>
                              {property && (
                                <p className="text-xs text-muted-foreground">
                                  {property.name || property.address}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {unscheduledTasks.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{unscheduledTasks.length - 5} more unscheduled tasks
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </TabsContents>
        </div>
      </Tabs>
    </div>
  );
}

