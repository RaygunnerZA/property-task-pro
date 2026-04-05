import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useThemes } from "@/hooks/useThemes";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { useCategories } from "@/hooks/useCategories";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import TaskCard from "@/components/TaskCard";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import EmptyState from "@/components/EmptyState";
import { FilterBar, type FilterOption, type FilterGroup } from "@/components/ui/filters/FilterBar";
import { ViewToggle } from "@/components/tasks/ViewToggle";
import { cn } from "@/lib/utils";
import { Calendar, AlertTriangle, User, CheckSquare, Clock, UserX, ExternalLink, Tag, Building2, Users, ArrowDown, Minus, Search } from "lucide-react";
import { FilterChip } from "@/components/chips/filter";

interface TaskListProps {
  tasks?: any[]; // Accept tasks as prop instead of fetching
  properties?: any[]; // Accept properties as prop instead of fetching
  tasksLoading?: boolean; // Accept loading state
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
  filterToApply?: string | null; // Filter ID to apply programmatically
  filtersToApply?: string[] | null; // Replace current selected filters programmatically
  /** When provided, property filter uses this set (ALL = size === properties.length → show all). */
  selectedPropertyIds?: Set<string>;
}

export function TaskList({ 
  tasks: tasksProp,
  properties: propertiesProp,
  tasksLoading: tasksLoadingProp,
  onTaskClick, 
  selectedTaskId,
  filterToApply,
  filtersToApply,
  selectedPropertyIds: selectedPropertyIdsProp,
}: TaskListProps = {}) {
  const navigate = useNavigate();
  
  // Only fetch if props not provided (for backward compatibility)
  const { data: tasksDataFromQuery = [], isLoading: loadingFromQuery, error: errorFromQuery } = useTasksQuery();
  const { data: propertiesFromQuery = [] } = usePropertiesQuery();
  
  // Use props if provided, otherwise fall back to queries
  const tasksData = tasksProp ?? tasksDataFromQuery;
  const properties = propertiesProp ?? propertiesFromQuery;
  const loading = tasksLoadingProp ?? loadingFromQuery;
  const error = errorFromQuery;
  const { themes } = useThemes();
  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const { categories } = useCategories();
  const { userId } = useDataContext();
  
  // Property filters start as inactive by default (no filters = show all properties)
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(() => {
    return new Set();
  });
  const [view, setView] = useState<'horizontal' | 'vertical'>('vertical');
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const tasksPanelInteractionRef = useRef<HTMLDivElement | null>(null);

  // Parse tasks from view (handles JSON arrays for spaces/themes/teams)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      // Parse JSON arrays if they exist
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
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

  // Extract unique spaces from tasks
  const allSpaces = useMemo(() => {
    const spaceMap = new Map<string, { id: string; name: string; property_id: string }>();
    tasks.forEach((task: any) => {
      if (task.spaces && Array.isArray(task.spaces)) {
        task.spaces.forEach((space: any) => {
          if (space.id && !spaceMap.has(space.id)) {
            spaceMap.set(space.id, {
              id: space.id,
              name: space.name || space.type || 'Unknown',
              property_id: task.property_id,
            });
          }
        });
      }
    });
    return Array.from(spaceMap.values());
  }, [tasks]);

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
      filtered = filtered.filter((task) => task.assigned_user_id === userId);
    }

    const q = taskSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((task) => {
        const title = String(task.title || "").toLowerCase();
        const desc = String(task.description || "").toLowerCase();
        const prop = task.property_id
          ? String(propertyMap.get(task.property_id)?.name || propertyMap.get(task.property_id)?.address || "").toLowerCase()
          : "";
        return title.includes(q) || desc.includes(q) || prop.includes(q);
      });
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
        if (selectedFilters.has("filter-responsibility-unassigned") && !task.assigned_user_id) return true;
        if (selectedFilters.has("filter-responsibility-external")) {
          return task.assigned_user_id && task.assigned_user_id !== userId;
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

    // Secondary filters - Property (use prop when provided; else FilterBar selectedFilters)
    if (selectedPropertyIdsProp !== undefined && properties.length > 0) {
      const isAllActive = selectedPropertyIdsProp.size === properties.length;
      if (!isAllActive) {
        filtered = filtered.filter((task) =>
          task.property_id && selectedPropertyIdsProp.has(task.property_id)
        );
      }
    } else {
      const propertyFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-property-"));
      if (propertyFilterIds.length > 0) {
        const selectedPropertyIds = propertyFilterIds.map(f => f.replace("filter-property-", ""));
        filtered = filtered.filter((task) => {
          return task.property_id && selectedPropertyIds.includes(task.property_id);
        });
      }
    }

    // Secondary filters - Space
    const spaceFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-space-"));
    if (spaceFilterIds.length > 0) {
      const selectedSpaceIds = spaceFilterIds.map(f => f.replace("filter-space-", ""));
      filtered = filtered.filter((task) => {
        if (!task.spaces || !Array.isArray(task.spaces)) return false;
        const taskSpaceIds = task.spaces.map((s: any) => s.id).filter(Boolean);
        return selectedSpaceIds.some(spaceId => taskSpaceIds.includes(spaceId));
      });
    }

    // Secondary filters - Assigned to Person
    const personFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-assigned-person-"));
    if (personFilterIds.length > 0) {
      const selectedPersonIds = personFilterIds.map(f => f.replace("filter-assigned-person-", ""));
      filtered = filtered.filter((task) => {
        return task.assigned_user_id && selectedPersonIds.includes(task.assigned_user_id);
      });
    }

    // Secondary filters - Assigned to Team
    const teamFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-assigned-team-"));
    if (teamFilterIds.length > 0) {
      const selectedTeamIds = teamFilterIds.map(f => f.replace("filter-assigned-team-", ""));
      filtered = filtered.filter((task) => {
        if (!task.teams || !Array.isArray(task.teams)) return false;
        const taskTeamIds = task.teams.map((t: any) => t.id).filter(Boolean);
        return selectedTeamIds.some(teamId => taskTeamIds.includes(teamId));
      });
    }

    // Secondary filters - Category
    const categoryFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-category-"));
    if (categoryFilterIds.length > 0) {
      const selectedCategoryIds = categoryFilterIds.map(f => f.replace("filter-category-", ""));
      // Note: Categories are not in tasks_view yet, so we'll need to fetch separately if needed
      // For now, this is a placeholder that will work once categories are added to the view
      // filtered = filtered.filter((task) => {
      //   const taskCategoryIds = taskCategories.get(task.id) || [];
      //   return selectedCategoryIds.some(categoryId => taskCategoryIds.includes(categoryId));
      // });
    }

    // Secondary filters - Priority
    const priorityFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-priority-"));
    if (priorityFilterIds.length > 0) {
      const selectedPriorities = priorityFilterIds.map(f => f.replace("filter-priority-", ""));
      filtered = filtered.filter((task) => {
        if (!task.priority) return false;
        // Handle normalization: "normal" and "medium" are treated the same
        const taskPriority = task.priority === "medium" ? "normal" : task.priority;
        return selectedPriorities.some(p => {
          const filterPriority = p === "medium" ? "normal" : p;
          return taskPriority === filterPriority;
        });
      });
    }

    // Secondary filters - Date Due
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

    return filtered;
  }, [tasks, selectedFilters, userId, taskThemes, selectedPropertyIdsProp, properties, taskSearchQuery, propertyMap]);

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
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      id: "filter-urgent",
      label: "Urgent",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "#EB6834", // Accent color
    },
    {
      id: "filter-assigned-me",
      label: "My Tasks",
      icon: <User className="h-4 w-4" />,
    },
  ];

  const secondaryGroups: FilterGroup[] = [
    {
      id: "status",
      label: "Status",
      options: [
        {
          id: "filter-status-todo",
          label: "To-Do",
          icon: <CheckSquare className="h-4 w-4" />,
        },
        {
          id: "filter-status-in-progress",
          label: "In Progress",
          icon: <Clock className="h-4 w-4" />,
        },
        {
          id: "filter-status-blocked",
          label: "Blocked",
          icon: <AlertTriangle className="h-4 w-4" />,
        },
        {
          id: "filter-status-done",
          label: "Done",
          icon: <CheckSquare className="h-4 w-4" />,
        },
      ],
    },
    {
      id: "date-due",
      label: "Date Due",
      options: [
        {
          id: "filter-date-today",
          label: "Today",
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          id: "filter-date-tomorrow",
          label: "Tomorrow",
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          id: "filter-date-this-week",
          label: "This Week",
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          id: "filter-date-overdue",
          label: "Overdue",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "#EB6834",
        },
      ],
    },
    {
      id: "priority",
      label: "Priority",
      options: [
        {
          id: "filter-priority-low",
          label: "Low",
          icon: <ArrowDown className="h-4 w-4" />,
        },
        {
          id: "filter-priority-normal",
          label: "Normal",
          icon: <Minus className="h-4 w-4" />,
        },
        {
          id: "filter-priority-high",
          label: "High",
          icon: <AlertTriangle className="h-4 w-4" />,
        },
        {
          id: "filter-priority-urgent",
          label: "Urgent",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "#EB6834",
        },
      ],
    },
    {
      id: "assigned-to",
      label: "Assigned To",
      options: [
        // People options
        ...members.map((member) => ({
          id: `filter-assigned-person-${member.user_id}`,
          label: member.display_name || member.email || 'Unknown',
          icon: <User className="h-4 w-4" />,
        })),
        // Team options
        ...teams.map((team) => ({
          id: `filter-assigned-team-${team.id}`,
          label: team.name,
          icon: <Users className="h-4 w-4" />,
        })),
      ],
    },
    {
      id: "property",
      label: "Property",
      options: properties.map((property) => ({
        id: `filter-property-${property.id}`,
        label: property.name || property.address || 'Unknown',
        icon: <Building2 className="h-4 w-4" />,
      })),
    },
    {
      id: "space",
      label: "Space",
      options: allSpaces.map((space) => ({
        id: `filter-space-${space.id}`,
        label: space.name,
        icon: <Building2 className="h-4 w-4" />,
      })),
    },
    // TODO: Re-enable category filter once categories are added to tasks_view
    // { id: "category", label: "Category", options: categories.map(...) }
  ];

  const handleFilterChange = useCallback((filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(filterId);
      } else {
        next.delete(filterId);
      }
      return next;
    });
  }, []);

  // Note: Property filters are not auto-selected - users must explicitly select them
  
  // Apply filter programmatically when filterToApply prop changes
  useEffect(() => {
    if (filterToApply) {
      setSelectedFilters((prev) => {
        const next = new Set(prev);
        // Toggle the filter - if it's already selected, deselect it; otherwise select it
        if (next.has(filterToApply)) {
          next.delete(filterToApply);
        } else {
          next.add(filterToApply);
        }
        return next;
      });
    }
  }, [filterToApply]);

  // Replace filters programmatically (used by assistant action suggestions)
  useEffect(() => {
    if (!filtersToApply) return;
    setSelectedFilters(new Set(filtersToApply));
  }, [filtersToApply]);
  
  // Memoize click handlers to prevent recreation on every render
  const handleTaskClick = useCallback((taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    } else {
      navigate(`/task/${taskId}`);
    }
  }, [onTaskClick, navigate]);
  
  // Memoize task card props to ensure stable references
  // Create onClick handlers inline but ensure they're stable by using task.id directly
  // The React.memo comparison will prevent re-renders when props are equal
  const memoizedTaskCards = useMemo(() => {
    const createCardProps = (task: any) => {
      const property = task.property_id
        ? propertyMap.get(task.property_id)
        : undefined;
      const isSelected = selectedTaskId === task.id;
      const taskId = task.id; // Capture task.id in closure for stability
      return {
        task,
        property,
        isSelected,
        onClick: () => handleTaskClick(taskId),
      };
    };

    const doneSorted = [...groupedTasks.done]
      .sort((a, b) => {
        const tb = new Date(b.updated_at || b.created_at || 0).getTime();
        const ta = new Date(a.updated_at || a.created_at || 0).getTime();
        return tb - ta;
      })
      .slice(0, 6);

    return {
      todo: groupedTasks.todo.map(createCardProps),
      done: doneSorted.map(createCardProps),
    };
  }, [groupedTasks.todo, groupedTasks.done, propertyMap, selectedTaskId, handleTaskClick]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

  // Check if filters are active but no tasks match
  const hasActiveFilters = selectedFilters.size > 0 || taskSearchQuery.trim().length > 0;
  const hasNoMatchingTasks = groupedTasks.todo.length === 0 && groupedTasks.done.length === 0;

  return (
    <div ref={tasksPanelInteractionRef} className="flex flex-col h-full min-h-0">
      {/* Filter Bar - fixed at top, does not scroll with list */}
      <div className="flex-shrink-0 mt-0 mb-[18px] pb-0" style={{ marginLeft: '-3px' }}>
        <FilterBar
          primaryOptions={primaryOptions}
          secondaryGroups={secondaryGroups}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          rightElement={<ViewToggle view={view} onViewChange={setView} />}
          collapseFilterChipAfterMs={2000}
          collapseInteractionRootRef={tasksPanelInteractionRef}
          primaryTrailing={
            <FilterChip
              label="Search"
              icon={<Search className="h-4 w-4" />}
              selected={taskSearchOpen || taskSearchQuery.trim().length > 0}
              onSelect={() => setTaskSearchOpen((open) => !open)}
              className="h-[24px]"
            />
          }
        />
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            taskSearchOpen || taskSearchQuery.trim().length > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <input
              type="search"
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              placeholder="Search tasks by title, notes, or property"
              className={cn(
                "mt-2 w-full rounded-[10px] bg-background shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.6)]",
                "px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              )}
              aria-label="Search tasks"
            />
          </div>
        </div>
      </div>

      {/* Scrollable task list area - independent of filter bar */}
      <div className="flex-1 flex flex-col min-h-0 max-h-[calc(100vh-280px)] overflow-y-auto rounded-[12px]">
        {/* Show empty state if filters are active but no tasks match */}
        {hasActiveFilters && hasNoMatchingTasks ? (
          <EmptyState 
            title="No tasks match your filters" 
            subtitle="Try adjusting your filter selections to see more tasks." 
          />
        ) : (
          <div className="space-y-6">
            {/* Todo Section - wrapped so space-y-6 doesn't add margin above desktop grid (mobile div is first sibling) */}
            {groupedTasks.todo.length > 0 && (
            <div>
              {view === 'vertical' ? (
                <>
                  {/* Mobile: Horizontal scroll */}
                  <div className="overflow-x-auto -mx-4 px-4 mt-[7px] scrollbar-hz-teal md:hidden">
                    <div className="flex gap-4 min-w-max">
                      {memoizedTaskCards.todo.map((props) => (
                        <div key={props.task.id} className="w-[210px] flex-shrink-0">
                          <TaskCard
                            {...props}
                            layout="vertical"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Desktop: Grid layout - 4 columns */}
                  <div className={cn(
                    "hidden md:grid md:grid-cols-3 gap-3 mt-0",
                    groupedTasks.todo.length === 1 && "md:grid-cols-1",
                    groupedTasks.todo.length === 2 && "md:grid-cols-2"
                  )}>
                    {memoizedTaskCards.todo.map((props) => (
                      <TaskCard
                        key={props.task.id}
                        {...props}
                        layout="vertical"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3 mt-0">
                  {memoizedTaskCards.todo.map((props) => (
                    <TaskCard
                      key={props.task.id}
                      {...props}
                      layout="horizontal"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Done: one row per task, max 6 (most recently updated) */}
          {groupedTasks.done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                <span>Done ({groupedTasks.done.length})</span>
                {groupedTasks.done.length > 6 ? (
                  <span className="normal-case font-normal text-muted-foreground/80">
                    {" "}
                    · showing 6 most recent
                  </span>
                ) : null}
              </h2>
              <div className="flex flex-col gap-2">
                {memoizedTaskCards.done.map((props) => (
                  <TaskCard
                    key={props.task.id}
                    {...props}
                    layout="horizontal"
                  />
                ))}
              </div>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

