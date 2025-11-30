import SkeletonTaskCard from "./SkeletonTaskCard";
import EmptyState from "./EmptyState";
import TaskCard from "./TaskCard";
import { useTasks } from "../hooks/useTasks";

export default function TaskList({ orgId }: { orgId?: string }) {
  const { tasks, loading, error } = useTasks(orgId);

  if (loading) return (
    <div className="space-y-3">
      <SkeletonTaskCard />
      <SkeletonTaskCard />
      <SkeletonTaskCard />
    </div>
  );

  if (error) return (
    <EmptyState title="Unable to load tasks" subtitle={error} />
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
