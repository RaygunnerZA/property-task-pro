import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useThemes } from "@/hooks/useThemes";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import TaskCard from "@/components/TaskCard";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import EmptyState from "@/components/EmptyState";
import { FilterBar, type FilterOption, type FilterGroup } from "@/components/ui/filters/FilterBar";
import { cn } from "@/lib/utils";
import { Calendar, AlertTriangle, User, CheckSquare, Clock, UserX, ExternalLink, Tag } from "lucide-react";

interface TaskListProps {
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
}

export function TaskList({ onTaskClick, selectedTaskId }: TaskListProps = {}) {
  const navigate = useNavigate();
  const { data: tasksData = [], isLoading: loading, error } = useTasksQuery();
  const { data: properties = [] } = usePropertiesQuery();
  const { themes } = useThemes();
  const { userId } = useDataContext();
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set()); // No default filters

  // Parse tasks from view (handles JSON arrays for spaces/themes/teams)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      // Parse JSON arrays if they exist
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      // Map assignee_user_id to assigned_user_id for backward compatibility
      assigned_user_id: task.assignee_user_id,
    }));
  }, [tasksData]);

  // Create task themes map from parsed themes JSON array
  const taskThemes = useMemo(() => {
    const themeMap = new Map<string, string[]>();
    tasks.forEach((task: any) => {
      if (task.themes && Array.isArray(task.themes)) {
        themeMap.set(task.id, task.themes.map((t: any) => t.id));
      }
    });
    return themeMap;
  }, [tasks]);

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Primary filters
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
      filtered = filtered.filter((task) => task.priority === "urgent" || task.priority === "high");
    }

    if (selectedFilters.has("filter-assigned-me")) {
      filtered = filtered.filter((task) => (task as any).assigned_user_id === userId);
    }

    // Secondary filters - Status
    const statusFilters = ["filter-status-todo", "filter-status-in-progress", "filter-status-blocked", "filter-status-done"];
    const hasStatusFilter = statusFilters.some(f => selectedFilters.has(f));
    if (hasStatusFilter) {
      filtered = filtered.filter((task) => {
        if (selectedFilters.has("filter-status-todo") && task.status === "open") return true;
        if (selectedFilters.has("filter-status-in-progress") && task.status === "in_progress") return true;
        if (selectedFilters.has("filter-status-blocked") && task.status === "blocked") return true;
        if (selectedFilters.has("filter-status-done") && task.status === "completed") return true;
        return false;
      });
    }

    // Secondary filters - Responsibility
    const responsibilityFilters = ["filter-responsibility-unassigned", "filter-responsibility-external"];
    const hasResponsibilityFilter = responsibilityFilters.some(f => selectedFilters.has(f));
    if (hasResponsibilityFilter) {
      filtered = filtered.filter((task) => {
        if (selectedFilters.has("filter-responsibility-unassigned") && !(task as any).assigned_user_id) return true;
        if (selectedFilters.has("filter-responsibility-external")) {
          // External tasks - check if assigned to external user or has external flag
          // For now, we'll check if assigned_user_id exists but is not in org members
          // This is a simplified check - you may need to enhance this
          return (task as any).assigned_user_id && (task as any).assigned_user_id !== userId;
        }
        return false;
      });
    }

    // Secondary filters - Theme
    const themeFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-theme-"));
    if (themeFilterIds.length > 0) {
      const selectedThemeIds = themeFilterIds.map(f => f.replace("filter-theme-", ""));
      filtered = filtered.filter((task) => {
        const taskThemeIds = taskThemes.get(task.id) || [];
        return selectedThemeIds.some(themeId => taskThemeIds.includes(themeId));
      });
    }

    return filtered;
  }, [tasks, selectedFilters, userId, taskThemes]);

  // Group filtered tasks by status
  const groupedTasks = useMemo(() => {
    const todo = filteredTasks.filter(
      (task) => task.status === "open" || task.status === "in_progress"
    );
    const done = filteredTasks.filter((task) => task.status === "completed");

    return { todo, done };
  }, [filteredTasks]);

  // Filter options
  const primaryOptions: FilterOption[] = [
    {
      id: "filter-due",
      label: "Due",
      icon: <Calendar className="h-3 w-3" />,
    },
    {
      id: "filter-urgent",
      label: "Urgent",
      icon: <AlertTriangle className="h-3 w-3" />,
      color: "#EB6834", // Accent color
    },
    {
      id: "filter-assigned-me",
      label: "Assigned to Me",
      icon: <User className="h-3 w-3" />,
    },
  ];

  const secondaryGroups: FilterGroup[] = [
    {
      id: "status",
      label: "Status",
      options: [
        {
          id: "filter-status-todo",
          label: "Todo",
          icon: <CheckSquare className="h-3 w-3" />,
        },
        {
          id: "filter-status-in-progress",
          label: "In Progress",
          icon: <Clock className="h-3 w-3" />,
        },
        {
          id: "filter-status-blocked",
          label: "Blocked",
          icon: <AlertTriangle className="h-3 w-3" />,
        },
        {
          id: "filter-status-done",
          label: "Done",
          icon: <CheckSquare className="h-3 w-3" />,
        },
      ],
    },
    {
      id: "responsibility",
      label: "Responsibility",
      options: [
        {
          id: "filter-responsibility-unassigned",
          label: "Unassigned",
          icon: <UserX className="h-3 w-3" />,
        },
        {
          id: "filter-responsibility-external",
          label: "External",
          icon: <ExternalLink className="h-3 w-3" />,
        },
      ],
    },
    {
      id: "theme",
      label: "Theme",
      options: themes.map((theme) => ({
        id: `filter-theme-${theme.id}`,
        label: theme.name,
        icon: <Tag className="h-3 w-3" />,
        color: theme.color || undefined,
      })),
    },
  ];

  const handleFilterChange = (filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(filterId);
      } else {
        next.delete(filterId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState title="Unable to load tasks" subtitle={error?.message || String(error)} />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState 
        title="No tasks" 
        subtitle="Create your first task using the + button" 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        primaryOptions={primaryOptions}
        secondaryGroups={secondaryGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
      />

      {/* Todo Section */}
      {groupedTasks.todo.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-3">
            {groupedTasks.todo.map((task) => {
              const property = task.property_id
                ? propertyMap.get(task.property_id)
                : undefined;
              const isSelected = selectedTaskId === task.id;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  property={property}
                  isSelected={isSelected}
                  onClick={() => {
                    if (onTaskClick) {
                      onTaskClick(task.id);
                    } else {
                      navigate(`/task/${task.id}`);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Done Section */}
      {groupedTasks.done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Done ({groupedTasks.done.length})
          </h2>
          <div className="space-y-3">
            {groupedTasks.done.map((task) => {
              const property = task.property_id
                ? propertyMap.get(task.property_id)
                : undefined;
              const isSelected = selectedTaskId === task.id;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  property={property}
                  isSelected={isSelected}
                  onClick={() => {
                    if (onTaskClick) {
                      onTaskClick(task.id);
                    } else {
                      navigate(`/task/${task.id}`);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

