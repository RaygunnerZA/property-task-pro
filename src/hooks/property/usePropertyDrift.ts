import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyDrift {
  hasDrift: boolean;
  count: number;
  items: Array<{
    id: string;
    ruleTitle: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Hook to fetch property drift data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch drift for
 * @returns Drift data and loading state
 */
export const usePropertyDrift = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: drift, isLoading } = useQuery({
    queryKey: queryKeys.propertyDrift(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyDrift> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return {
        hasDrift: true,
        count: 1,
        items: [
          {
            id: '1',
            ruleTitle: 'Fire Safety Inspection',
            severity: 'medium'
          }
        ]
      };
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { 
    drift: drift || { hasDrift: false, count: 0, items: [] }, 
    isLoading 
  };
};
