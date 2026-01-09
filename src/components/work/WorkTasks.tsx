import { useState } from 'react';
import TaskCard from '@/components/TaskCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { mockTasks, mockProperties } from '@/data/mockData';
import { TaskStatus } from '@/types/task';
import { SegmentControl, SegmentOption } from '@/components/filla';

const WorkTasks = () => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  return (
    <div className="space-y-4">
      <SegmentControl 
        options={filterOptions}
        selectedId={filter}
        onChange={(id) => setFilter(id as TaskStatus | 'all')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 col-span-full">
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              property={getProperty(task.propertyId)}
              layout="vertical"
              onClick={() => handleTaskClick(task.id)}
            />
          ))
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </div>
  );
};

export default WorkTasks;
