import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyTasksSummary {
  activeTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
}

/**
 * Hook to fetch property tasks summary.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch tasks summary for
 * @returns Tasks summary data and loading state
 */
export const usePropertyTasks = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: tasksSummary, isLoading } = useQuery({
    queryKey: queryKeys.propertyTasksSummary(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyTasksSummary> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return {
        activeTasks: 3,
        overdueTasks: 1,
        completedThisMonth: 8
      };
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { 
    tasksSummary: tasksSummary || { activeTasks: 0, overdueTasks: 0, completedThisMonth: 0 }, 
    isLoading 
  };
};
