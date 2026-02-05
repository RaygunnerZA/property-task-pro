import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/animated-tabs";
import { TaskList } from "@/components/tasks/TaskList";
import MessageList from "@/components/MessageList";
import TaskCard from "@/components/TaskCard";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { CheckSquare, Inbox, Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { cn } from "@/lib/utils";
import { addDays, format, isAfter, startOfDay, subDays } from "date-fns";
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
  selectedPropertyIds?: Set<string>;
  onCreateTask?: () => void;
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
  selectedDate: selectedDateProp,
  filterToApply,
  selectedPropertyIds,
  onCreateTask
}: TaskPanelProps = {}) {
  const navigate = useNavigate();
  const [internalActiveTab, setInternalActiveTab] = useState("tasks");
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePinned, setIsDatePinned] = useState(false);
  const selectedDate = selectedDateProp ?? internalSelectedDate;
  
  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Apply property filter when selectedPropertyIds provided (ALL = show all)
  const tasksForView = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0 || selectedPropertyIds.size === properties.length) {
      return tasks;
    }
    return tasks.filter((t) => t.property_id && selectedPropertyIds.has(t.property_id));
  }, [tasks, selectedPropertyIds, properties.length]);

  // Get unscheduled tasks (no due_date) for backlog section
  const unscheduledTasks = useMemo(() => {
    return tasksForView.filter((task) => {
      if (!task.due_date && !task.due_at) {
        if (task.status === "completed" || task.status === "archived") return false;
        return true;
      }
      return false;
    });
  }, [tasksForView]);

  const scheduleStats = useMemo(() => {
    const active = tasksForView.filter(
      (t) => t.status !== "completed" && t.status !== "archived"
    );
    const withDueDate = active.filter((t) => !!(t.due_date || t.due_at));
    const withId = active.filter((t) => !!t.id);
    return {
      total: tasks.length,
      active: active.length,
      withDueDate: withDueDate.length,
      withoutDueDate: active.length - withDueDate.length,
      withoutId: active.length - withId.length,
    };
  }, [tasksForView]);

  // Filter tasks for Schedule tab - by selectedDate if provided, otherwise upcoming
  const scheduleTasks = useMemo(() => {
    if (selectedDate && isDatePinned) {
      // Filter by selected date - normalize both dates to start of day for accurate comparison
      const selectedDateNormalized = startOfDay(selectedDate);
      const selectedDateStr = format(selectedDateNormalized, "yyyy-MM-dd");
      return tasksForView
        .filter((task) => {
          const dueValue = task.due_date || task.due_at;
          if (!dueValue) return false;
          if (!task.id) return false;
          if (task.status === "completed" || task.status === "archived") return false;
          try {
            // Normalize task due_date to start of day for comparison
            const taskDateNormalized = startOfDay(new Date(dueValue));
            const taskDateStr = format(taskDateNormalized, "yyyy-MM-dd");
            const matches = taskDateStr === selectedDateStr;
            return matches;
          } catch (error) {
            return false;
          }
        })
        .sort((a, b) => {
          // Sort by time if available, otherwise by creation date
          const aValue = a.due_date || a.due_at;
          const bValue = b.due_date || b.due_at;
          const aTime = aValue ? new Date(aValue).getTime() : 0;
          const bTime = bValue ? new Date(bValue).getTime() : 0;
          return aTime - bTime;
        });
    } else {
      // Show upcoming tasks
      const today = startOfDay(new Date());
      return tasksForView
        .filter((task) => {
          const dueValue = task.due_date || task.due_at;
          if (!dueValue) return false;
          if (!task.id) return false;
          if (task.status === "completed" || task.status === "archived") return false;
          try {
            const dueDate = startOfDay(new Date(dueValue));
            return isAfter(dueDate, today) || dueDate.getTime() === today.getTime();
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const aValue = a.due_date || a.due_at;
          const bValue = b.due_date || b.due_at;
          if (!aValue || !bValue) return 0;
          return new Date(aValue).getTime() - new Date(bValue).getTime();
        })
        .slice(0, 25); // Give the schedule tab enough to feel "alive"
    }
  }, [tasksForView, selectedDate, isDatePinned]);

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col pt-[3px] pb-[3px]">
        {/* Sticky Tab Bar */}
        <div className="sticky top-0 z-10 bg-background ml-[8px] mr-[14px] flex md:justify-between items-center">
          <TabsList
            className={cn(
              "w-full md:w-[373px] grid md:flex grid-cols-3 h-12 py-1 pl-0 pr-0 gap-1.5 rounded-[15px] bg-transparent",
              "shadow-[inset_2px_6.6px_9.4px_0px_rgba(0,0,0,0.23),inset_0px_-5.7px_5.8px_0px_rgba(255,255,255,0.62)]"
            )}
          >
            <TabsTrigger
              value="tasks"
              className={cn(
                "rounded-[8px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
              style={{ paddingLeft: '26px', paddingRight: '26px' }}
            >
              <AnimatedIcon 
                icon={CheckSquare} 
                size={16} 
                animateOnHover
                animation="path-draw"
                className="mr-0.5 -ml-[10px]"
                style={{ width: '31px' }}
              />
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="inbox"
              className={cn(
                "rounded-[8px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
              style={{ paddingLeft: '24px', paddingRight: '24px' }}
            >
              <AnimatedIcon 
                icon={Inbox} 
                size={16} 
                animateOnHover
                animation="shake"
                className="mr-2"
              />
              Inbox
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className={cn(
                "rounded-[8px] transition-all",
                "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                "data-[state=active]:bg-card",
                "data-[state=inactive]:bg-transparent",
                "text-sm font-medium"
              )}
              style={{ paddingLeft: '24px', paddingRight: '24px' }}
            >
              <AnimatedIcon 
                icon={Calendar} 
                size={16} 
                animateOnHover
                animation="pointing"
                className="mr-2"
              />
              Schedule
            </TabsTrigger>
          </TabsList>
          {/* Create Task Button - Right aligned */}
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="hidden md:flex items-center gap-2 px-4 h-9 rounded-lg bg-[#85BABC] text-white font-medium shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.4)] hover:bg-[#85BABC]/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Task
            </button>
          )}
        </div>

        {/* Content Area (each tab owns its own scrolling to avoid nested scroll/height collapse) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="h-full flex flex-col min-h-0 pt-[8px] pl-2 pr-4 pb-4">
              <TaskList 
                tasks={tasks}
                properties={properties}
                tasksLoading={tasksLoading}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedItem?.type === 'task' ? selectedItem.id : undefined}
                filterToApply={filterToApply}
                selectedPropertyIds={selectedPropertyIds}
              />
            </div>
          )}

          {/* Inbox Tab */}
          {activeTab === "inbox" && (
            <div className="h-full min-h-0 overflow-y-auto p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inbox
              </h3>
              <MessageList 
                onMessageClick={onMessageClick}
                selectedMessageId={selectedItem?.type === 'message' ? selectedItem.id : undefined}
              />
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === "schedule" && (
            <div className="h-full min-h-0 overflow-hidden">
              {tasksLoading ? (
                <div className="p-4 space-y-3">
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="h-full flex flex-col min-h-0">
                  {/* Date navigation */}
                  <div className="px-4 pt-4 pb-3 border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-foreground truncate">
                          {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Upcoming"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date();
                            setInternalSelectedDate(today);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "px-3 h-9 rounded-[8px] text-sm font-medium",
                            "bg-card shadow-e1 border border-border/50",
                            "hover:shadow-md transition-shadow"
                          )}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          aria-label="Previous day"
                          onClick={() => {
                            if (!selectedDate) return;
                            const newDate = subDays(selectedDate, 1);
                            setInternalSelectedDate(newDate);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "h-9 w-9 rounded-[8px] grid place-items-center",
                            "bg-card shadow-e1 border border-border/50",
                            "hover:shadow-md transition-shadow"
                          )}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next day"
                          onClick={() => {
                            if (!selectedDate) return;
                            const newDate = addDays(selectedDate, 1);
                            setInternalSelectedDate(newDate);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "h-9 w-9 rounded-[8px] grid place-items-center",
                            "bg-card shadow-e1 border border-border/50",
                            "hover:shadow-md transition-shadow"
                          )}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {scheduleTasks.length > 0 ? (
                      <div className="h-full min-h-0">
                        <ScheduleView
                          tasks={scheduleTasks}
                          properties={properties}
                          selectedDate={isDatePinned ? selectedDate : undefined}
                          onTaskClick={onTaskClick}
                          selectedTaskId={selectedItem?.type === 'task' ? selectedItem.id : undefined}
                          showDateHeaders={false}
                        />
                      </div>
                    ) : (
                      <div className="p-4 flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                        <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          {selectedDate && isDatePinned
                            ? `No tasks scheduled for ${format(selectedDate, "EEEE, MMMM d")}`
                            : "No upcoming tasks"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedDate && isDatePinned
                            ? "Try selecting a different date or create a new task with a due date"
                            : "Create a task with a due date to see it here"}
                        </p>
                        <div className="mt-3 text-[11px] text-muted-foreground/80">
                          {scheduleStats.withDueDate === 0 ? (
                            <span>
                              You currently have 0 active tasks with a due date/time. ({scheduleStats.withoutDueDate} unscheduled)
                            </span>
                          ) : (
                            <span>
                              Active: {scheduleStats.active} • With due date: {scheduleStats.withDueDate} • Unscheduled: {scheduleStats.withoutDueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

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
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

