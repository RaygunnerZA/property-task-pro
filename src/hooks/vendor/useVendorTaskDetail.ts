import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { VendorTask } from './useVendorTasks';

/**
 * Hook to fetch vendor task details.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param taskId - The task ID to fetch
 * @returns Task data, loading state, and updateStatus function
 */
export const useVendorTaskDetail = (taskId: string) => {
  const { data: task = null, isLoading } = useQuery({
    queryKey: queryKeys.vendorTaskDetail(taskId),
    queryFn: async (): Promise<VendorTask | null> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return {
        id: taskId,
        title: 'Fix leaking faucet in Unit 203',
        description: 'Kitchen faucet has been dripping for 2 days. Tenant reports water waste.',
        status: 'Assigned',
        due_at: '2024-01-15',
        property_name: 'Sunset Apartments',
        priority: 'high'
      };
    },
    enabled: !!taskId,
    staleTime: 60 * 1000, // 1 minute
    retry: 0, // Don't retry mock implementation
  });

  // Note: updateStatus would need to be a mutation when backend is connected
  const updateStatus = (newStatus: VendorTask['status']) => {
    // TODO: Implement mutation for status update
    console.log('Status update (not yet implemented):', newStatus);
  };

  return { task, isLoading, updateStatus };
};
