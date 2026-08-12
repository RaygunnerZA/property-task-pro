/**
 * Shared workbench Filter / Sort application for task lists
 * (TaskList + Messages card grid).
 */

import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";
import { isTaskMissingInfo } from "@/lib/hubSummaryMetrics";
import {
  TASK_STATUS_FILTER_IDS,
  taskMatchesStatusFilters,
} from "@/lib/taskStatus";
import {
  isPropertySubsetSelected,
  scopedPropertyIdSet,
} from "@/utils/propertyFilter";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  normal: 2,
  low: 3,
};

export type WorkbenchTaskFilterContext = {
  userId?: string | null;
  properties?: Array<{ id: string; name?: string | null; address?: string | null }>;
  /** Scope property chips from the left rail (ALL = show all). */
  selectedPropertyIds?: Set<string>;
  searchQuery?: string;
};

function parseSpaces(task: any): any[] {
  if (Array.isArray(task.spaces)) return task.spaces;
  if (typeof task.spaces === "string") {
    try {
      const parsed = JSON.parse(task.spaces);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseTeams(task: any): any[] {
  if (Array.isArray(task.teams)) return task.teams;
  if (typeof task.teams === "string") {
    try {
      const parsed = JSON.parse(task.teams);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseThemeIds(task: any): string[] {
  const themes =
    typeof task.themes === "string"
      ? (() => {
          try {
            return JSON.parse(task.themes);
          } catch {
            return [];
          }
        })()
      : task.themes;
  if (!Array.isArray(themes)) return [];
  return themes.map((t: any) => t?.id).filter(Boolean);
}

/** Apply FilterBar / workbench selectedFilters to a task list. */
export function filterTasksByWorkbenchFilters(
  tasks: any[],
  selectedFilters: Set<string> | ReadonlySet<string>,
  ctx: WorkbenchTaskFilterContext = {}
): any[] {
  const { userId, properties = [], selectedPropertyIds, searchQuery = "" } = ctx;
  const propertyMap = new Map(properties.map((p) => [p.id, p]));
  let filtered = [...tasks];

  if (selectedFilters.has("filter-due")) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filtered = filtered.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    });
  }

  if (selectedFilters.has("filter-urgent")) {
    filtered = filtered.filter(
      (task) => task.priority === "urgent" || task.priority === "high"
    );
  }

  if (selectedFilters.has("filter-assigned-me")) {
    filtered = filtered.filter((task) => task.assigned_user_id === userId);
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((task) => {
      const title = String(task.title || "").toLowerCase();
      const desc = String(task.description || "").toLowerCase();
      const prop = task.property_id
        ? String(
            propertyMap.get(task.property_id)?.name ||
              propertyMap.get(task.property_id)?.address ||
              ""
          ).toLowerCase()
        : "";
      return title.includes(q) || desc.includes(q) || prop.includes(q);
    });
  }

  if (TASK_STATUS_FILTER_IDS.some((f) => selectedFilters.has(f))) {
    filtered = filtered.filter((task) =>
      taskMatchesStatusFilters(task.status, selectedFilters)
    );
  }

  const responsibilityFilters = [
    "filter-responsibility-unassigned",
    "filter-responsibility-external",
  ];
  if (responsibilityFilters.some((f) => selectedFilters.has(f))) {
    filtered = filtered.filter((task) => {
      if (selectedFilters.has("filter-responsibility-unassigned") && !task.assigned_user_id) {
        return true;
      }
      if (selectedFilters.has("filter-responsibility-external")) {
        return Boolean(task.assigned_user_id && task.assigned_user_id !== userId);
      }
      return false;
    });
  }

  const themeFilterIds = Array.from(selectedFilters).filter((f) =>
    f.startsWith("filter-theme-")
  );
  if (themeFilterIds.length > 0) {
    const selectedThemeIds = themeFilterIds.map((f) => f.replace("filter-theme-", ""));
    filtered = filtered.filter((task) => {
      const taskThemeIds = parseThemeIds(task);
      return selectedThemeIds.some((themeId) => taskThemeIds.includes(themeId));
    });
  }

  if (selectedPropertyIds !== undefined && properties.length > 0) {
    const allPropertyIds = properties.map((p) => p.id);
    if (isPropertySubsetSelected(selectedPropertyIds, allPropertyIds)) {
      const scopedIds = scopedPropertyIdSet(selectedPropertyIds, allPropertyIds);
      filtered = filtered.filter(
        (task) => task.property_id != null && scopedIds.has(task.property_id)
      );
    }
  } else {
    const propertyFilterIds = Array.from(selectedFilters).filter((f) =>
      f.startsWith("filter-property-")
    );
    if (propertyFilterIds.length > 0) {
      const ids = propertyFilterIds.map((f) => f.replace("filter-property-", ""));
      filtered = filtered.filter(
        (task) => task.property_id && ids.includes(task.property_id)
      );
    }
  }

  const spaceFilterIds = Array.from(selectedFilters).filter((f) =>
    f.startsWith("filter-space-")
  );
  if (spaceFilterIds.length > 0) {
    const selectedSpaceIds = spaceFilterIds.map((f) => f.replace("filter-space-", ""));
    filtered = filtered.filter((task) => {
      const spaces = parseSpaces(task);
      const taskSpaceIds = spaces.map((s: any) => s.id).filter(Boolean);
      return selectedSpaceIds.some((spaceId) => taskSpaceIds.includes(spaceId));
    });
  }

  const personFilterIds = Array.from(selectedFilters).filter((f) =>
    f.startsWith("filter-assigned-person-")
  );
  if (personFilterIds.length > 0) {
    const selectedPersonIds = personFilterIds.map((f) =>
      f.replace("filter-assigned-person-", "")
    );
    filtered = filtered.filter(
      (task) =>
        task.assigned_user_id && selectedPersonIds.includes(task.assigned_user_id)
    );
  }

  const teamFilterIds = Array.from(selectedFilters).filter((f) =>
    f.startsWith("filter-assigned-team-")
  );
  if (teamFilterIds.length > 0) {
    const selectedTeamIds = teamFilterIds.map((f) => f.replace("filter-assigned-team-", ""));
    filtered = filtered.filter((task) => {
      const teams = parseTeams(task);
      const taskTeamIds = teams.map((t: any) => t.id).filter(Boolean);
      return selectedTeamIds.some((teamId) => taskTeamIds.includes(teamId));
    });
  }

  const priorityFilterIds = Array.from(selectedFilters).filter((f) =>
    f.startsWith("filter-priority-")
  );
  if (priorityFilterIds.length > 0) {
    const selectedPriorities = priorityFilterIds.map((f) =>
      f.replace("filter-priority-", "")
    );
    filtered = filtered.filter((task) => {
      if (!task.priority) return false;
      const taskPriority = task.priority === "medium" ? "normal" : task.priority;
      return selectedPriorities.some((p) => {
        const filterPriority = p === "medium" ? "normal" : p;
        return taskPriority === filterPriority;
      });
    });
  }

  if (selectedFilters.has("filter-date-today")) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    filtered = filtered.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate < tomorrow;
    });
  }

  if (selectedFilters.has("filter-date-tomorrow")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    filtered = filtered.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= tomorrow && dueDate < dayAfter;
    });
  }

  if (selectedFilters.has("filter-date-this-week")) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    filtered = filtered.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate < weekFromNow;
    });
  }

  if (selectedFilters.has("filter-date-overdue")) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filtered = filtered.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  }

  if (selectedFilters.has("filter-task-missing-info")) {
    filtered = filtered.filter((task) => isTaskMissingInfo(task));
  }

  return filtered;
}

export function sortTasksByWorkbenchSort(tasks: any[], sortBy: WorkbenchSortBy): any[] {
  const sorted = [...tasks];
  if (sortBy === "priority") {
    return sorted.sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    );
  }
  if (sortBy === "title") {
    return sorted.sort((a, b) =>
      String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, {
        sensitivity: "base",
      })
    );
  }
  if (sortBy === "due_date") {
    return sorted.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }
  if (sortBy === "updated") {
    return sorted.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
    );
  }
  return sorted.sort(
    (a, b) =>
      new Date(b.created_at || b.updated_at || 0).getTime() -
      new Date(a.created_at || a.updated_at || 0).getTime()
  );
}
