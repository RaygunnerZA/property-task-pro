import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTasks } from "@/hooks/use-tasks";
import { useProperties } from "@/hooks/useProperties";
import TaskCard from "@/components/TaskCard";
import SkeletonTaskCard from "@/components/SkeletonTaskCard";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";

interface TaskListProps {
  onTaskClick?: (taskId: string) => void;
}

export function TaskList({ onTaskClick }: TaskListProps = {}) {
  const navigate = useNavigate();
  const { tasks, loading, error } = useTasks();
  const { properties } = useProperties();

  // Create property map for quick lookup
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const todo = tasks.filter(
      (task) => task.status === "open" || task.status === "in_progress"
    );
    const done = tasks.filter((task) => task.status === "completed");

    return { todo, done };
  }, [tasks]);

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
      <EmptyState title="Unable to load tasks" subtitle={error} />
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
      {/* Todo Section */}
      {groupedTasks.todo.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Todo ({groupedTasks.todo.length})
          </h2>
          <div className="space-y-3">
            {groupedTasks.todo.map((task) => {
              const property = task.property_id
                ? propertyMap.get(task.property_id)
                : undefined;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  property={property}
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
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  property={property}
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

