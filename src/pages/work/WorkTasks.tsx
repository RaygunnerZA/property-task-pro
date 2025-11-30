import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskCard from '@/components/TaskCard';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { Surface, Heading, SegmentControl, SegmentedControlOption } from '@/components/filla';
import { useTasks } from '@/hooks/useTasks';

export default function WorkTasks() {
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { tasks, loading } = useTasks('all');

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
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <Heading variant="l" className="mb-4">Tasks</Heading>
        <SegmentControl 
          options={filterOptions}
          selectedId={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <Surface variant="neomorphic" className="p-8 text-center">
          <p className="text-muted-foreground">Loading tasks...</p>
        </Surface>
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
        <Surface variant="neomorphic" className="p-8 text-center">
          <p className="text-muted-foreground">No tasks found</p>
        </Surface>
      )}

      <FloatingAddButton />
    </div>
  );
}
