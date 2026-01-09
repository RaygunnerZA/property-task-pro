import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskCard from '@/components/TaskCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { SegmentControl, SegmentedControlOption } from '@/components/filla';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { CheckSquare, Plus } from 'lucide-react';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';

export default function WorkTasks() {
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const [filter, setFilter] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { data: tasksData = [], isLoading: loading } = useTasksQuery(propertyId || undefined);

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

  const filterOptions: SegmentedControlOption[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Done' },
  ];

  const filteredTasks = tasks?.filter((task) => {
    // Filter by property if propertyId is provided
    if (propertyId && task.property_id !== propertyId) return false;
    
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'active') return task.status !== 'completed';
    return true;
  });

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  return (
    <StandardPage
      title="Tasks"
      subtitle={filteredTasks ? `${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'}` : undefined}
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="mb-6">
        <SegmentControl 
          options={filterOptions}
          selectedId={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading tasks..." />
      ) : filteredTasks && filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              property={null}
              layout="vertical"
              onClick={() => handleTaskClick(task.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="Create your first task to get started"
          action={{
            label: "Add Task",
            onClick: () => {},
            icon: Plus
          }}
        />
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}

      <FloatingAddButton />
    </StandardPage>
  );
}
