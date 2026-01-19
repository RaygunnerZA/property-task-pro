import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Hook to fetch pending compliance reviews.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns empty array as backend service is not yet implemented.
 * This is a placeholder for future pending reviews functionality.
 * 
 * @returns Reviews array and loading state
 */
export function usePendingReviews() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: reviews = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.pendingReviews(orgId ?? undefined),
    queryFn: async (): Promise<any[]> => {
      // TODO: Placeholder - will call complianceReviews service
      // For now, return empty array
      return [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry stub implementation
  });

  return { reviews, loading };
}
