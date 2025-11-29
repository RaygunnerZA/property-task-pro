import { useState, useEffect } from 'react';

export interface VendorTask {
  id: string;
  title: string;
  description: string;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Waiting Review';
  due_at: string;
  property_name?: string;
  priority: string;
}

/**
 * Stub hook for vendor task list
 * Returns placeholder task data
 */
export const useVendorTasks = () => {
  const [tasks, setTasks] = useState<VendorTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setTasks([
        {
          id: 'task-1',
          title: 'Fix leaking faucet in Unit 203',
          description: 'Kitchen faucet has been dripping',
          status: 'Assigned',
          due_at: '2024-01-15',
          property_name: 'Sunset Apartments',
          priority: 'high'
        },
        {
          id: 'task-2',
          title: 'Replace HVAC filter',
          description: 'Routine maintenance',
          status: 'In Progress',
          due_at: '2024-01-16',
          property_name: 'Oak Street Building',
          priority: 'medium'
        },
        {
          id: 'task-3',
          title: 'Inspect fire extinguishers',
          description: 'Monthly safety check',
          status: 'Completed',
          due_at: '2024-01-10',
          property_name: 'Sunset Apartments',
          priority: 'low'
        }
      ]);
      setIsLoading(false);
    }, 300);
  }, []);

  const stats = {
    assigned: tasks.filter(t => t.status === 'Assigned').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    completed: tasks.filter(t => t.status === 'Completed').length
  };

  return { tasks, isLoading, stats };
};
