import { format } from "date-fns";
import type { CalendarTypeId } from "@/lib/calendarTypes";
import { inferCalendarType } from "@/lib/calendarTypes";
import { parseScheduleDateTime } from "@/lib/calendarTaskSchedule";

export type DayUrgency = "none" | "low" | "normal" | "high" | "urgent" | "overdue";

export type TaskDateData = {
  total: number;
  high: number;
  urgent: number;
  overdue: number;
  maxUrgency: DayUrgency;
};

const URGENCY_RANK: Record<DayUrgency, number> = {
  none: 0,
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
  overdue: 5,
};

function normalizePriority(priority: string | null | undefined): string {
  if (!priority) return "normal";
  const n = priority.toLowerCase();
  if (n === "medium") return "normal";
  return n;
}

function priorityToUrgency(priority: string | null | undefined, isOverdue: boolean): DayUrgency {
  if (isOverdue) return "overdue";
  const norm = normalizePriority(priority);
  if (norm === "urgent") return "urgent";
  if (norm === "high") return "high";
  if (norm === "low") return "low";
  return "normal";
}

function mergeUrgency(a: DayUrgency, b: DayUrgency): DayUrgency {
  return URGENCY_RANK[b] > URGENCY_RANK[a] ? b : a;
}

export function buildTasksByDate(
  tasks: Array<{
    due_date?: string | null;
    due_at?: string | null;
    status?: string | null;
    priority?: string | null;
    milestones?: Array<{ dateTime?: string }> | null;
  }>
): Map<string, TaskDateData> {
  const map = new Map<string, TaskDateData>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const add = (dateValue: string, priority: string | null | undefined) => {
    try {
      const date = parseScheduleDateTime(dateValue);
      if (!date) return;
      const dateKey = format(date, "yyyy-MM-dd");
      const current = map.get(dateKey) ?? {
        total: 0,
        high: 0,
        urgent: 0,
        overdue: 0,
        maxUrgency: "none" as DayUrgency,
      };
      current.total += 1;
      const norm = normalizePriority(priority);
      if (norm === "high") current.high += 1;
      else if (norm === "urgent") current.urgent += 1;
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const isOverdue = day < today;
      if (isOverdue) current.overdue += 1;
      const u = priorityToUrgency(priority, isOverdue);
      current.maxUrgency = mergeUrgency(current.maxUrgency, u);
      map.set(dateKey, current);
    } catch {
      /* skip invalid */
    }
  };

  tasks.forEach((task) => {
    if (task.status === "completed" || task.status === "archived") return;
    const due = task.due_date || task.due_at;
    if (due) add(due, task.priority);
    if (Array.isArray(task.milestones)) {
      task.milestones.forEach((m) => {
        if (m?.dateTime) add(m.dateTime, task.priority);
      });
    }
  });

  return map;
}

export function dayCellBackground(maxUrgency: DayUrgency, isSelected: boolean): string | undefined {
  if (isSelected) return "rgba(255, 255, 255, 1)";
  switch (maxUrgency) {
    case "overdue":
    case "urgent":
      return "rgba(235, 104, 52, 0.2)";
    case "high":
      return "rgba(232, 160, 74, 0.18)";
    case "normal":
      return "rgba(142, 201, 206, 0.2)";
    case "low":
      return "rgba(142, 201, 206, 0.1)";
    default:
      return undefined;
  }
}

export function dayDotColor(maxUrgency: DayUrgency): string | undefined {
  if (maxUrgency === "none") return undefined;
  if (maxUrgency === "overdue" || maxUrgency === "urgent" || maxUrgency === "high") {
    return "#EB6834";
  }
  return "#8EC9CE";
}

export function filterTasksForCalendar(
  tasks: any[],
  options: {
    selectedPropertyIds?: Set<string>;
    allPropertyIds: string[];
    selectedCalendarTypes: Set<CalendarTypeId>;
  }
): any[] {
  const { selectedPropertyIds, allPropertyIds, selectedCalendarTypes } = options;
  const isAllProperties =
    !selectedPropertyIds ||
    selectedPropertyIds.size === 0 ||
    selectedPropertyIds.size >= allPropertyIds.length;

  return tasks.filter((task) => {
    if (task.status === "completed" || task.status === "archived") return false;
    if (!isAllProperties && task.property_id && !selectedPropertyIds!.has(task.property_id)) {
      return false;
    }
    if (
      !selectedCalendarTypes.has("all") &&
      selectedCalendarTypes.size > 0 &&
      selectedCalendarTypes.size < 5
    ) {
      const type = inferCalendarType(task);
      if (!selectedCalendarTypes.has(type)) return false;
    }
    return true;
  });
}

/** Header search + workbench filter chips applied to calendar task lists. */
export function applyCalendarDisplayFilters(
  tasks: any[],
  options: {
    searchQuery?: string;
    propertyMap?: Map<string, { nickname?: string; name?: string; address?: string }>;
    selectedWorkbenchFilters?: Set<string>;
    userId?: string | null;
  }
): any[] {
  const { searchQuery, propertyMap, selectedWorkbenchFilters, userId } = options;
  let list = tasks;

  const q = (searchQuery ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter((task) => {
      const title = String(task.title ?? "").toLowerCase();
      const desc = String(task.description ?? "").toLowerCase();
      const prop = task.property_id
        ? String(
            propertyMap?.get(task.property_id)?.nickname ||
              propertyMap?.get(task.property_id)?.name ||
              propertyMap?.get(task.property_id)?.address ||
              task.property_name ||
              ""
          ).toLowerCase()
        : String(task.property_name ?? "").toLowerCase();
      return title.includes(q) || desc.includes(q) || prop.includes(q);
    });
  }

  if (!selectedWorkbenchFilters || selectedWorkbenchFilters.size === 0) {
    return list;
  }

  const filters = selectedWorkbenchFilters;

  if (filters.has("filter-urgent")) {
    list = list.filter((t) => t.priority === "urgent" || t.priority === "high");
  }

  if (filters.has("filter-assigned-me") && userId) {
    list = list.filter((t) => t.assigned_user_id === userId);
  }

  const statusFilters = [
    "filter-status-todo",
    "filter-status-in-progress",
    "filter-status-waiting-review",
    "filter-status-blocked",
    "filter-status-done",
  ];
  if (statusFilters.some((f) => filters.has(f))) {
    list = list.filter((task) => {
      if (filters.has("filter-status-todo") && task.status === "open") return true;
      if (filters.has("filter-status-in-progress") && task.status === "in_progress") return true;
      if (filters.has("filter-status-waiting-review") && task.status === "waiting_review")
        return true;
      if (filters.has("filter-status-blocked") && task.status === "blocked") return true;
      if (filters.has("filter-status-done") && task.status === "completed") return true;
      return false;
    });
  }

  const priorityFilterIds = Array.from(filters).filter((f) => f.startsWith("filter-priority-"));
  if (priorityFilterIds.length > 0) {
    list = list.filter((task) => {
      const taskPriority = task.priority === "medium" ? "normal" : task.priority;
      return priorityFilterIds.some((filterId) => {
        const filterPriority = filterId.replace("filter-priority-", "");
        return taskPriority === filterPriority;
      });
    });
  }

  return list;
}
