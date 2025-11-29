import { useState, useEffect } from 'react';
import { VendorTask } from './useVendorTasks';

/**
 * Stub hook for vendor task detail
 * Returns placeholder task details
 */
export const useVendorTaskDetail = (taskId: string) => {
  const [task, setTask] = useState<VendorTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setTask({
        id: taskId,
        title: 'Fix leaking faucet in Unit 203',
        description: 'Kitchen faucet has been dripping for 2 days. Tenant reports water waste.',
        status: 'Assigned',
        due_at: '2024-01-15',
        property_name: 'Sunset Apartments',
        priority: 'high'
      });
      setIsLoading(false);
    }, 300);
  }, [taskId]);

  const updateStatus = (newStatus: VendorTask['status']) => {
    if (task) {
      setTask({ ...task, status: newStatus });
    }
  };

  return { task, isLoading, updateStatus };
};
