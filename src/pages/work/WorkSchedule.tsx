import { useState, useMemo } from 'react';
import TaskCard from '@/components/TaskCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';

type TimeGroup = 'overdue' | 'today' | 'tomorrow' | 'next_7_days' | 'later';

interface GroupedTasks {
  overdue: any[];
  today: any[];
  tomorrow: any[];
  next_7_days: any[];
  later: any[];
}

export default function WorkSchedule() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { data: tasksData = [], isLoading: loading } = useTasksQuery();

  // Parse tasks from view (handles JSON arrays and assignee mapping)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
      // Map due_date to due_at for backward compatibility
      due_at: task.due_date,
    }));
  }, [tasksData]);

  const groupTasksByTime = (): GroupedTasks => {
    const grouped: GroupedTasks = {
      overdue: [],
      today: [],
      tomorrow: [],
      next_7_days: [],
      later: [],
    };

    if (!tasks) return grouped;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    tasks.forEach(task => {
      if (!task.due_at) {
        grouped.later.push(task);
        return;
      }

      const dueDate = new Date(task.due_at);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      if (dueDateOnly < today && task.status !== 'completed') {
        grouped.overdue.push(task);
      } else if (dueDateOnly.getTime() === today.getTime()) {
        grouped.today.push(task);
      } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
        grouped.tomorrow.push(task);
      } else if (dueDateOnly < nextWeek) {
        grouped.next_7_days.push(task);
      } else {
        grouped.later.push(task);
      }
    });

    return grouped;
  };

  const groupedTasks = groupTasksByTime();

  const getGroupLabel = (group: TimeGroup): string => {
    switch (group) {
      case 'overdue': return 'Overdue';
      case 'today': return 'Today';
      case 'tomorrow': return 'Tomorrow';
      case 'next_7_days': return 'Next 7 Days';
      case 'later': return 'Later';
    }
  };

  const getGroupColor = (group: TimeGroup): string => {
    switch (group) {
      case 'overdue': return 'text-destructive';
      case 'today': return 'text-primary';
      default: return 'text-foreground';
    }
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  const renderGroup = (group: TimeGroup, tasks: any[]) => {
    if (tasks.length === 0) return null;

    return (
      <div key={group} className="mb-8">
        <h2 className={`text-lg font-semibold mb-3 ${getGroupColor(group)}`}>
          {getGroupLabel(group)} ({tasks.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              property={null}
              layout="vertical"
              onClick={() => handleTaskClick(task.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <StandardPage
      title="Schedule"
      subtitle="Tasks organized by due date"
      icon={<Calendar className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading schedule..." />
      ) : (
        <>
          {renderGroup('overdue', groupedTasks.overdue)}
          {renderGroup('today', groupedTasks.today)}
          {renderGroup('tomorrow', groupedTasks.tomorrow)}
          {renderGroup('next_7_days', groupedTasks.next_7_days)}
          {renderGroup('later', groupedTasks.later)}

          {tasks && tasks.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No tasks scheduled"
              description="Create tasks to see them organized by due date"
            />
          )}
        </>
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </StandardPage>
  );
}
