import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

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
 * Hook to fetch vendor tasks.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @returns Vendor tasks array, loading state, and stats
 */
export const useVendorTasks = () => {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: queryKeys.vendorTasks(),
    queryFn: async (): Promise<VendorTask[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
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
      ];
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 0, // Don't retry mock implementation
  });

  const stats = {
    assigned: tasks.filter(t => t.status === 'Assigned').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    completed: tasks.filter(t => t.status === 'Completed').length
  };

  return { tasks, isLoading, stats };
};
