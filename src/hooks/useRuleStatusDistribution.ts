import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

interface StatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface UseRuleStatusDistributionResult {
  data: StatusData[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch rule status distribution data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @returns Status distribution data, loading state, and error state
 */
export const useRuleStatusDistribution = (): UseRuleStatusDistributionResult => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.ruleStatusDistribution(orgId ?? undefined),
    queryFn: async (): Promise<StatusData[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        { status: 'Approved', count: 32, percentage: 67, color: '#22c55e' },
        { status: 'Pending Review', count: 10, percentage: 21, color: '#f59e0b' },
        { status: 'Draft', count: 6, percentage: 12, color: '#6366f1' },
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
