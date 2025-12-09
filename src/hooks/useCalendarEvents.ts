import { useTasks } from "@/hooks/useTasks";
import type { CalendarEvent, TaskEvent } from "@/components/filla/MiniCalendar";

/**
 * Convert tasks from useTasks hook into MiniCalendar events format
 */
export function useCalendarEvents(selectedMonth?: Date): CalendarEvent[] {
  const { tasks } = useTasks();

  const events: Map<string, CalendarEvent> = new Map();

  for (const task of tasks) {
    if (!task.due_at) continue;

    const dateKey = task.due_at.slice(0, 10); // ISO date "YYYY-MM-DD"

    // Map task priority to calendar priority
    let priority: "low" | "normal" | "high" = "normal";
    if (task.priority === "low") priority = "low";
    else if (task.priority === "urgent") priority = "high";
    else priority = "normal";

    const taskEvent: TaskEvent = { priority };

    if (!events.has(dateKey)) {
      events.set(dateKey, {
        date: dateKey,
        tasks: [taskEvent],
        compliance: [],
      });
    } else {
      const existing = events.get(dateKey)!;
      existing.tasks = [...(existing.tasks || []), taskEvent];
    }

    // Add compliance events if task is compliance-related
    if (task.is_compliance && task.compliance_level) {
      const existing = events.get(dateKey)!;
      let severity: "low" | "medium" | "high" = "medium";
      if (task.compliance_level === "low") severity = "low";
      else if (task.compliance_level === "critical" || task.compliance_level === "high") severity = "high";
      
      existing.compliance = [...(existing.compliance || []), { severity }];
    }
  }

  return Array.from(events.values());
}

/**
 * Get tasks for a specific date range
 */
export function useTasksForDateRange(startDate: Date, endDate: Date) {
  const { tasks, loading, error } = useTasks();

  const filteredTasks = tasks.filter(task => {
    if (!task.due_at) return false;
    const dueDate = new Date(task.due_at);
    return dueDate >= startDate && dueDate <= endDate;
  });

  return { tasks: filteredTasks, loading, error };
}

/**
 * Get tasks for a specific date
 */
export function useTasksForDate(date: Date) {
  const { tasks, loading, error } = useTasks();

  const dateStr = date.toISOString().slice(0, 10);
  
  const filteredTasks = tasks.filter(task => {
    if (!task.due_at) return false;
    return task.due_at.slice(0, 10) === dateStr;
  });

  return { tasks: filteredTasks, loading, error };
}
