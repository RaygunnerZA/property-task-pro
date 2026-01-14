import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import EmptyState from "@/components/EmptyState";

// Custom FunnelX icon component (not available in lucide-react)
const FunnelX = ({ className, style, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide lucide-funnel-x", className)}
    style={{ width: '24px', height: '24px', ...style }}
    {...props}
  >
    <path d="M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473"/>
    <path d="m16.5 3.5 5 5"/>
    <path d="m21.5 3.5-5 5"/>
  </svg>
);

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

  const filters: { id: FilterType; label: string }[] = [
    { id: 'urgent', label: 'Urgent' },
    { id: 'open', label: 'Open' },
    { id: 'overdue', label: 'Overdue' },
  ];

  if (tasksLoading) {
    return (
      <div className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
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
      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
        {filters.map((filter) => {
          const isActive = selectedFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-[5px] font-mono text-[13px] uppercase tracking-wider whitespace-nowrap transition-all shadow-e1',
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-concrete/50 text-ink/70 hover:bg-concrete'
              )}
            >
              {filter.label}
            </button>
          );
        })}
        {/* Filter Button */}
        <button
          onClick={() => setSelectedFilter(null)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] flex-shrink-0",
            "select-none cursor-pointer transition-all",
            "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
            "hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
          )}
          title="Filter"
        >
          <FunnelX className="h-6 w-6" style={{ width: '24px', height: '24px' }} />
          <span className="font-mono text-[13px] uppercase tracking-wider">FILTER</span>
        </button>
      </div>

      {/* Task List - One row, horizontal scroll */}
      {filteredTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No tasks to display
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
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

