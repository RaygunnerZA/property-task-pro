import { useMemo } from "react";
import SkeletonTaskCard from "./SkeletonTaskCard";
import EmptyState from "./EmptyState";
import TaskCard from "./TaskCard";
import { useTasksQuery } from "@/hooks/useTasksQuery";

export default function TaskList() {
  const { data: tasksData = [], isLoading: loading, error } = useTasksQuery();

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
    }));
  }, [tasksData]);

  if (loading) return (
    <div className="space-y-3">
      <SkeletonTaskCard />
      <SkeletonTaskCard />
      <SkeletonTaskCard />
    </div>
  );

  if (error) return (
    <EmptyState title="Unable to load tasks" subtitle={error?.message || String(error)} />
  );

  if (!tasks.length) return (
    <EmptyState title="No tasks" subtitle="Create your first task using the + button" />
  );

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
