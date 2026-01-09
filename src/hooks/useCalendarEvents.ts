import { useMemo } from "react";
import { useTasksQuery } from "@/hooks/useTasksQuery";

// Types for calendar events (previously from MiniCalendar)
export interface TaskEvent {
  priority: "low" | "normal" | "high";
}

export interface ComplianceEvent {
  severity: "low" | "medium" | "high";
}

export interface CalendarEvent {
  date: string; // ISO format: "2025-12-15"
  tasks?: TaskEvent[];
  compliance?: ComplianceEvent[];
}

/**
 * Convert tasks from useTasksQuery hook into CalendarEvent format
 * @deprecated This hook is deprecated. Use DashboardCalendar with tasks directly.
 */
export function useCalendarEvents(selectedMonth?: Date): CalendarEvent[] {
  const { data: tasksData = [] } = useTasksQuery();

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
      // Map due_date to due_at for backward compatibility
      due_at: task.due_date,
    }));
  }, [tasksData]);

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
  const { data: tasksData = [], isLoading: loading, error } = useTasksQuery();

  // Parse tasks from view
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
      due_at: task.due_date,
    }));
  }, [tasksData]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.due_at && !task.due_date) return false;
      const dueDate = new Date(task.due_at || task.due_date);
      return dueDate >= startDate && dueDate <= endDate;
    });
  }, [tasks, startDate, endDate]);

  return { tasks: filteredTasks, loading, error };
}

/**
 * Get tasks for a specific date
 */
export function useTasksForDate(date: Date) {
  const { data: tasksData = [], isLoading: loading, error } = useTasksQuery();

  // Parse tasks from view
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
      due_at: task.due_date,
    }));
  }, [tasksData]);

  const dateStr = date.toISOString().slice(0, 10);
  
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.due_at && !task.due_date) return false;
      return (task.due_at || task.due_date)?.slice(0, 10) === dateStr;
    });
  }, [tasks, dateStr]);

  return { tasks: filteredTasks, loading, error };
}
