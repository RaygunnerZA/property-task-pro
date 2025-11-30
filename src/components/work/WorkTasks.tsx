import { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { mockTasks, mockProperties } from '@/data/mockData';
import { TaskStatus } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { SegmentControl, SegmentOption } from '@/components/filla';

const WorkTasks = () => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const navigate = useNavigate();

  const filterOptions: SegmentOption[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'in-progress', label: 'Active' },
    { id: 'completed', label: 'Done' },
  ];

  const filteredTasks = filter === 'all' 
    ? mockTasks 
    : mockTasks.filter(task => task.status === filter);

  const getProperty = (propertyId: string) => 
    mockProperties.find(p => p.id === propertyId)!;

  return (
    <div className="space-y-4">
      <SegmentControl 
        options={filterOptions}
        selectedId={filter}
        onChange={(id) => setFilter(id as TaskStatus | 'all')}
      />

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              property={getProperty(task.propertyId)}
              onClick={() => navigate(`/task/${task.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WorkTasks;
