import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskCard from '@/components/TaskCard';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { SegmentControl, SegmentedControlOption } from '@/components/filla';
import { useTasks } from '@/hooks/useTasks';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { CheckSquare, Plus } from 'lucide-react';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';

export default function WorkTasks() {
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();

  const filterOptions: SegmentedControlOption[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Done' },
  ];

  const filteredTasks = tasks?.filter((task) => {
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'active') return task.status !== 'completed';
    return true;
  });

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
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              property={null}
              onClick={() => navigate(`/task/${task.id}`)}
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

      <FloatingAddButton />
    </StandardPage>
  );
}
