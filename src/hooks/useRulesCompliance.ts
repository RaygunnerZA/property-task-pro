import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Hook to fetch rules compliance data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns empty array as backend service is not yet implemented.
 * This is a placeholder for future compliance rules functionality.
 * 
 * @returns Rules array and loading state
 */
export function useRulesCompliance() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: rules = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.rulesCompliance(orgId ?? undefined),
    queryFn: async (): Promise<any[]> => {
      // TODO: Placeholder - will call complianceRules service
      // For now, return empty array
      return [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry stub implementation
  });

  return { rules, loading };
}
