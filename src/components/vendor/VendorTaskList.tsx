import React from 'react';
import { VendorTaskCard } from './VendorTaskCard';
import { VendorTaskListEmpty } from './VendorTaskListEmpty';
import { useVendorTasks } from '@/hooks/vendor/useVendorTasks';
import { useNavigate } from 'react-router-dom';

export const VendorTaskList: React.FC = () => {
  const { tasks, isLoading } = useVendorTasks();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return <VendorTaskListEmpty />;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <VendorTaskCard 
          key={task.id} 
          task={task}
          onClick={() => navigate(`/vendor/tasks/${task.id}`)}
        />
      ))}
    </div>
  );
};
