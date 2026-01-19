import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyTimelineEvent {
  id: string;
  date: string;
  type: 'task' | 'drift' | 'compliance' | 'inspection';
  description: string;
}

/**
 * Hook to fetch property timeline events.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch timeline for
 * @returns Timeline events array and loading state
 */
export const usePropertyTimeline = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.propertyTimeline(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyTimelineEvent[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        {
          id: '1',
          date: '2025-01-03',
          type: 'task',
          description: 'Task completed: Annual fire safety check'
        },
        {
          id: '2',
          date: '2025-01-02',
          type: 'drift',
          description: 'Drift detected: Inspection overdue'
        },
        {
          id: '3',
          date: '2024-12-28',
          type: 'compliance',
          description: 'Compliance review passed'
        }
      ];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { events, isLoading };
};
