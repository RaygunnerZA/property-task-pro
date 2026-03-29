import { useState, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Filter, AlertTriangle, CircleDot, CalendarClock } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import EmptyState from "@/components/EmptyState";
import { FilterChip } from "@/components/chips/filter";

interface PropertyTasksSectionProps {
  propertyId: string;
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  selectedSpaceId?: string | null;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string;
}

type FilterType = 'urgent' | 'open' | 'overdue';

/**
 * Property Tasks Section
 * Custom task filter panel for property page with:
 * - Filter chips: Urgent | Open | Overdue (default: Urgent)
 * - Vertical card view (one row, horizontal scroll)
 * - "View all property tasks →" button
 */
export function PropertyTasksSection({
  propertyId,
  tasks = [],
  properties = [],
  tasksLoading = false,
  selectedSpaceId,
  onTaskClick,
  selectedTaskId,
}: PropertyTasksSectionProps) {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>('urgent');

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Filter tasks by space if selectedSpaceId is provided
  const spaceFilteredTasks = useMemo(() => {
    if (!selectedSpaceId) return tasks;
    
    return tasks.filter((task) => {
      if (!task.spaces) return false;
      try {
        const taskSpaces = typeof task.spaces === 'string' ? JSON.parse(task.spaces) : task.spaces;
        if (Array.isArray(taskSpaces)) {
          return taskSpaces.some((space: any) => space?.id === selectedSpaceId);
        }
      } catch {
        return false;
      }
      return false;
    });
  }, [tasks, selectedSpaceId]);

  // Filter tasks by property and selected filter
  const filteredTasks = useMemo(() => {
    let filtered = spaceFilteredTasks.filter((task) => task.property_id === propertyId);

    // If no filter is selected, show all tasks (excluding completed/archived)
    if (!selectedFilter) {
      return filtered.filter(
        (task) => task.status !== 'completed' && task.status !== 'archived'
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (selectedFilter) {
      case 'urgent':
        // Urgent: priority is 'urgent' or 'high', and status is not completed
        filtered = filtered.filter(
          (task) =>
            (task.priority === 'urgent' || task.priority === 'high') &&
            task.status !== 'completed' &&
            task.status !== 'archived'
        );
        break;

      case 'open':
        // Open: status is 'open' or 'in_progress', and not completed
        filtered = filtered.filter(
          (task) =>
            (task.status === 'open' || task.status === 'in_progress') &&
            task.status !== 'completed' &&
            task.status !== 'archived'
        );
        break;

      case 'overdue':
        // Overdue: has due_date, is before today, and status is not completed
        filtered = filtered.filter((task) => {
          if (!task.due_date) return false;
          if (task.status === 'completed' || task.status === 'archived') return false;
          try {
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
          } catch {
            return false;
          }
        });
        break;
    }

    // Sort by priority and due date
    return filtered.sort((a, b) => {
      // Priority order: urgent > high > normal > low
      const priorityOrder: Record<string, number> = {
        urgent: 4,
        high: 3,
        normal: 2,
        medium: 2,
        low: 1,
      };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Then by due date (earlier first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [spaceFilteredTasks, propertyId, selectedFilter]);

  const handleViewAll = () => {
    // Navigate to work/tasks with property filter
    navigate(`/work/tasks?propertyId=${propertyId}`);
  };

  const filterOptions: { id: FilterType | null; label: string; icon: ReactNode }[] = [
    { id: null, label: 'FILTER', icon: <Filter className="h-[14px] w-[14px]" /> },
    { id: 'urgent', label: 'URGENT', icon: <AlertTriangle className="h-[14px] w-[14px]" /> },
    { id: 'open', label: 'OPEN', icon: <CircleDot className="h-[14px] w-[14px]" /> },
    { id: 'overdue', label: 'OVERDUE', icon: <CalendarClock className="h-[14px] w-[14px]" /> },
  ];

  if (tasksLoading) {
    return (
      <div className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hz-teal">
          <div className="flex gap-4 min-w-max">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-[210px] flex-shrink-0">
                <SkeletonTaskCard />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Filter Chips - FilterChip for consistency with FilterBar */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
        {filterOptions.map((filter) => {
          const isActive = selectedFilter === filter.id;
          return (
            <FilterChip
              key={filter.id ?? 'filter'}
              label={filter.label}
              selected={isActive}
              onSelect={() => setSelectedFilter(filter.id)}
              icon={filter.icon}
              className="h-[24px] flex-shrink-0 whitespace-nowrap"
            />
          );
        })}
      </div>

      {/* Task List - One row, horizontal scroll */}
      {filteredTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No tasks to display
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hz-teal">
          <div className="flex gap-4 min-w-max">
            {filteredTasks.map((task) => {
              const property = propertyMap.get(task.property_id);
              return (
                <div key={task.id} className="w-[210px] flex-shrink-0">
                  <TaskCard
                    task={task}
                    property={property}
                    layout="vertical"
                    onClick={() => onTaskClick?.(task.id)}
                    isSelected={selectedTaskId === task.id}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View All Button */}
      <Button
        variant="ghost"
        onClick={handleViewAll}
        className="w-full justify-between text-muted-foreground hover:text-foreground"
      >
        <span className="font-mono text-[11px] uppercase tracking-wider">
          View all property tasks
        </span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

