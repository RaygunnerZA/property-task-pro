import TaskCard from "@/components/TaskCard";
import type { TaskMessagePreview } from "@/hooks/useTaskMessageActivity";
import { cn } from "@/lib/utils";

type TasksMessagesCardGridProps = {
  tasks: any[];
  properties?: any[];
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  messagePreviewsByTaskId: Record<string, TaskMessagePreview>;
  className?: string;
};

/**
 * Messages-tab-only task grid — always uses the 85px message-first card layout.
 * Kept separate from TaskList so the amended design cannot fall through to default cards.
 */
export function TasksMessagesCardGrid({
  tasks,
  properties = [],
  selectedTaskId,
  onTaskClick,
  messagePreviewsByTaskId,
  className,
}: TasksMessagesCardGridProps) {
  const propertyMap = new Map(properties.map((p: any) => [p.id, p]));

  if (tasks.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-muted-foreground">
        No tasks with messages in this view.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "list-stagger grid grid-cols-1 gap-3 sm:grid-cols-2",
        // minmax(0,1fr) prevents long titles from blowing out the column track
        "sm:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]",
        className
      )}
    >
      {tasks.map((task) => {
        const id = String(task.id);
        return (
          <div key={id} className="min-w-0 max-w-full overflow-hidden">
            <TaskCard
              task={task}
              property={task.property_id ? propertyMap.get(task.property_id) : undefined}
              isSelected={selectedTaskId === task.id}
              layout="messages"
              messagePreview={messagePreviewsByTaskId[id] ?? null}
              onClick={() => onTaskClick?.(id)}
            />
          </div>
        );
      })}
    </div>
  );
}
