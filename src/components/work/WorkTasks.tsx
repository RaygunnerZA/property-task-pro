import { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { mockTasks, mockProperties } from '@/data/mockData';
import { TaskStatus } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WorkTasks = () => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const navigate = useNavigate();

  const filteredTasks = filter === 'all' 
    ? mockTasks 
    : mockTasks.filter(task => task.status === filter);

  const getProperty = (propertyId: string) => 
    mockProperties.find(p => p.id === propertyId)!;

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus | 'all')}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in-progress">Active</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
        </TabsList>
      </Tabs>

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
