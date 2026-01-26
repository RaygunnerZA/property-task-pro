import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format, isToday, startOfDay } from "date-fns";
import { TaskCardActive } from "./TaskCardActive";
import { TaskCardMinimized } from "./TaskCardMinimized";
import { cn } from "@/lib/utils";

interface ScheduleViewProps {
  tasks: any[];
  properties?: any[];
  selectedDate?: Date | undefined;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
  showDateHeaders?: boolean;
}

/**
 * Schedule View Component
 * 
 * Displays tasks in a vertical timeline format:
 * - Shows dates as headers
 * - Only shows hours that have tasks (no empty hour slots)
 * - Time-scheduled tasks first, "Any Time" tasks at bottom
 */
export function ScheduleView({
  tasks,
  properties = [],
  selectedDate,
  onTaskClick,
  selectedTaskId,
}: ScheduleViewProps) {
  // #region agent log
  console.log('[DEBUG] ScheduleView component executing', {tasksCount:tasks.length,selectedDate:selectedDate?.toISOString()||null});
  useEffect(() => {
    console.log('[DEBUG] ScheduleView useEffect running', {tasksCount:tasks.length,selectedDate:selectedDate?.toISOString()||null});
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'F',location:'ScheduleView.tsx:23',message:'ScheduleView render',data:{tasksCount:tasks.length,selectedDate:selectedDate?.toISOString()||null,firstTask:tasks[0]||null},timestamp:Date.now()})}).catch((e)=>console.error('[DEBUG] ScheduleView log failed:',e));
  }, [tasks, selectedDate]);
  // #endregion
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Parse and categorize tasks
  const { timeTasks, anyTimeTasks } = useMemo(() => {
    const withTime: Array<{ task: any; time: Date; hour: number }> = [];
    const withoutTime: any[] = [];

    tasks.forEach((task) => {
      if (!task.due_date) {
        withoutTime.push(task);
        return;
      }

      try {
        const dueDate = new Date(task.due_date);
        // Check if task has a specific time (not just date)
        const startOfTaskDay = startOfDay(dueDate);
        const hasTime = dueDate.getTime() !== startOfTaskDay.getTime();
        
        if (hasTime) {
          withTime.push({ 
            task, 
            time: dueDate,
            hour: dueDate.getHours()
          });
        } else {
          withoutTime.push(task);
        }
      } catch {
        withoutTime.push(task);
      }
    });

    // Sort time tasks chronologically
    withTime.sort((a, b) => a.time.getTime() - b.time.getTime());

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'F',location:'ScheduleView.tsx:73',message:'Tasks categorized',data:{timeTasksCount:withTime.length,anyTimeTasksCount:withoutTime.length,totalTasks:tasks.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      timeTasks: withTime,
      anyTimeTasks: withoutTime,
    };
  }, [tasks]);

  // Group time tasks by date
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Array<{ task: any; time: Date; hour: number }>>();
    
    timeTasks.forEach(({ task, time, hour }) => {
      const dateKey = format(time, "yyyy-MM-dd");
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push({ task, time, hour });
    });
    
    // Sort tasks within each date by time
    grouped.forEach((tasks) => {
      tasks.sort((a, b) => a.time.getTime() - b.time.getTime());
    });
    
    return grouped;
  }, [timeTasks]);

  // Get dates sorted chronologically
  const dates = useMemo(() => {
    return Array.from(tasksByDate.keys()).sort();
  }, [tasksByDate]);

  // Get unique hours that have tasks (for time ruler)
  const hoursWithTasks = useMemo(() => {
    const hourSet = new Set<number>();
    timeTasks.forEach(({ time }) => {
      hourSet.add(time.getHours());
    });
    return Array.from(hourSet).sort((a, b) => a - b);
  }, [timeTasks]);

  // Set first task as active by default
  useEffect(() => {
    if (timeTasks.length > 0 && !activeTaskId) {
      setActiveTaskId(timeTasks[0].task.id);
    } else if (anyTimeTasks.length > 0 && timeTasks.length === 0 && !activeTaskId) {
      setActiveTaskId(anyTimeTasks[0].id);
    }
  }, [timeTasks, anyTimeTasks, activeTaskId]);

  // Set up IntersectionObserver to track top-most visible card
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry that's closest to the top of the viewport
        let topMostEntry: IntersectionObserverEntry | null = null;
        let closestTop = Infinity;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
            if (containerRect) {
              // Calculate position relative to scroll container
              const relativeTop = rect.top - containerRect.top;
              // Only consider cards that are visible and above the middle of viewport
              if (relativeTop >= 0 && relativeTop < closestTop && relativeTop < containerRect.height * 0.4) {
                closestTop = relativeTop;
                topMostEntry = entry;
              }
            }
          }
        });

        // If we found a top-most visible card, set it as active
        if (topMostEntry) {
          const taskId = topMostEntry.target.getAttribute('data-task-id');
          if (taskId) {
            setActiveTaskId(taskId);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '-10% 0px -50% 0px', // Consider cards in the top 40% of viewport
        threshold: [0, 0.1, 0.25, 0.5],
      }
    );

    // Observe all task elements after a brief delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      taskRefs.current.forEach((element) => {
        if (element && observerRef.current) {
          observerRef.current.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [timeTasks, anyTimeTasks]);

  // Register task element refs
  const setTaskRef = useCallback((taskId: string, element: HTMLDivElement | null) => {
    if (element) {
      taskRefs.current.set(taskId, element);
    } else {
      taskRefs.current.delete(taskId);
    }
  }, []);

  // Auto-scroll to current time if viewing today
  useEffect(() => {
    if (selectedDate && isToday(selectedDate) && scrollContainerRef.current && timeTasks.length > 0) {
      const now = new Date();
      
      // Find the first task at or after current time
      const currentTask = timeTasks.find(
        ({ time }) => time.getTime() >= now.getTime()
      );

      if (currentTask) {
        // Scroll to the task element
        const taskElement = scrollContainerRef.current.querySelector(
          `[data-task-id="${currentTask.task.id}"]`
        );
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else if (timeTasks.length > 0) {
        // If no future tasks, scroll to first task
        const firstTask = timeTasks[0];
        const taskElement = scrollContainerRef.current.querySelector(
          `[data-task-id="${firstTask.task.id}"]`
        );
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  }, [selectedDate, timeTasks]);

  return (
    <div className="flex h-full w-full relative">
      {/* Task Stack */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="space-y-6">
          {/* Time-scheduled tasks grouped by date */}
          {dates.map((dateKey) => {
            const dateTasks = tasksByDate.get(dateKey) || [];
            if (dateTasks.length === 0) return null;

            const date = new Date(dateKey);
            const isTodayDate = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const dateLabel = isTodayDate 
              ? "Today" 
              : format(date, "EEEE, MMMM d");

            return (
              <div key={dateKey} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 border-b border-border/50">
                  <h3 className="text-sm font-semibold text-foreground tracking-wide">
                    {dateLabel}
                  </h3>
                </div>

                {/* Tasks for this date */}
                {dateTasks.map(({ task, time, hour }) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;
                  const isActive = activeTaskId === task.id;
                  const timeLabel = format(time, "HH:mm");

                  return (
                    <div
                      key={task.id}
                      ref={(el) => setTaskRef(task.id, el)}
                      data-task-id={task.id}
                      className={cn(
                        "transition-all duration-300 ease-in-out",
                        isActive ? "opacity-100 scale-100" : "opacity-70 scale-[0.98]"
                      )}
                    >
                      {/* Time label inline with task */}
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0 pt-1">
                          {timeLabel}
                        </span>
                        <div className="flex-1">
                          {isActive ? (
                            <TaskCardActive
                              task={task}
                              property={property}
                              onClick={() => {
                                if (onTaskClick) {
                                  onTaskClick(task.id);
                                }
                              }}
                              onDetails={() => {
                                if (onTaskClick) {
                                  onTaskClick(task.id);
                                }
                              }}
                            />
                          ) : (
                            <TaskCardMinimized
                              task={task}
                              property={property}
                              onClick={() => {
                                if (onTaskClick) {
                                  onTaskClick(task.id);
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Any Time tasks section */}
          {anyTimeTasks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Any Time
              </h3>
              <div className="space-y-3">
                {anyTimeTasks.map((task) => {
                  const property = task.property_id
                    ? propertyMap.get(task.property_id)
                    : undefined;
                  const isActive = activeTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      ref={(el) => setTaskRef(task.id, el)}
                      data-task-id={task.id}
                      className={cn(
                        "transition-all duration-300 ease-in-out",
                        isActive ? "opacity-100 scale-100" : "opacity-70 scale-[0.98]"
                      )}
                    >
                      {isActive ? (
                        <TaskCardActive
                          task={task}
                          property={property}
                          onClick={() => {
                            if (onTaskClick) {
                              onTaskClick(task.id);
                            }
                          }}
                          onDetails={() => {
                            if (onTaskClick) {
                              onTaskClick(task.id);
                            }
                          }}
                        />
                      ) : (
                        <TaskCardMinimized
                          task={task}
                          property={property}
                          onClick={() => {
                            if (onTaskClick) {
                              onTaskClick(task.id);
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {timeTasks.length === 0 && anyTimeTasks.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No tasks scheduled for this date</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
