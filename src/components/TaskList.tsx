import { useTasks } from "../hooks/useTasks";
import TaskCard from "./TaskCard";
import EmptyState from "./EmptyState";
import SkeletonTaskCard from "./SkeletonTaskCard";

interface TaskListProps {
  orgId?: string;
}

export default function TaskList({ orgId }: TaskListProps) {
  const { tasks, loading, error } = useTasks(orgId);

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
    return <EmptyState title="Error loading tasks" subtitle={error} />;
  }

  if (tasks.length === 0) {
    return <EmptyState title="No tasks yet" subtitle="Create your first task" />;
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
