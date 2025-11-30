import SimpleTaskCard from "./SimpleTaskCard";
import EmptyState from "./EmptyState";

export default function TaskList() {
  const tasks: any[] = []; // placeholder until Supabase hook is added

  if (tasks.length === 0) return <EmptyState title="No tasks yet" subtitle="Create your first task" />;

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <SimpleTaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
