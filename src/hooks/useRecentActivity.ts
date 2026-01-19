import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

interface ActivityEvent {
  id: string;
  type: 'rule_approved' | 'drift_detected' | 'rule_created' | 'review_pending';
  message: string;
  timestamp: string;
  metadata?: {
    ruleName?: string;
    propertyName?: string;
  };
}

interface UseRecentActivityResult {
  data: ActivityEvent[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch recent activity events.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @returns Activity events array, loading state, and error state
 */
export const useRecentActivity = (): UseRecentActivityResult => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.recentActivity(orgId ?? undefined),
    queryFn: async (): Promise<ActivityEvent[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      const now = new Date();
      return [
        {
          id: '1',
          type: 'drift_detected',
          message: 'Compliance drift detected',
          timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
          metadata: {
            ruleName: 'Fire Safety Inspection Rule',
            propertyName: 'Park Plaza',
          },
        },
        {
          id: '2',
          type: 'rule_approved',
          message: 'Rule version approved',
          timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Emergency Exit Signage',
          },
        },
        {
          id: '3',
          type: 'review_pending',
          message: 'New rule pending review',
          timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Elevator Maintenance Protocol',
          },
        },
        {
          id: '4',
          type: 'rule_created',
          message: 'New rule created',
          timestamp: new Date(now.getTime() - 6 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Accessibility Standards',
          },
        },
        {
          id: '5',
          type: 'drift_detected',
          message: 'Compliance drift detected',
          timestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Water Quality Testing',
            propertyName: 'Garden Estates',
          },
        },
      ];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { 
    data, 
    loading, 
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null 
  };
};
