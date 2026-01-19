import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyComplianceStatus {
  status: 'good' | 'warning' | 'critical';
  score: number;
  compliantRules: number;
  totalRules: number;
}

/**
 * Hook to fetch property compliance status.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch compliance status for
 * @returns Compliance status data and loading state
 */
export const usePropertyCompliance = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: complianceStatus, isLoading } = useQuery({
    queryKey: queryKeys.propertyCompliance(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyComplianceStatus> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return {
        status: 'good',
        score: 85,
        compliantRules: 17,
        totalRules: 20
      };
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { 
    complianceStatus: complianceStatus || { status: 'good', score: 0, compliantRules: 0, totalRules: 0 }, 
    isLoading 
  };
};
