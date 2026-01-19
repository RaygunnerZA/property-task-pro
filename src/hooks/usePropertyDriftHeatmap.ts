import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

interface PropertyStatus {
  id: string;
  name: string;
  status: 'compliant' | 'pending' | 'non_compliant';
  driftCount: number;
}

interface UsePropertyDriftHeatmapResult {
  data: PropertyStatus[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch property drift heatmap data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @returns Property status data, loading state, and error state
 */
export const usePropertyDriftHeatmap = (): UsePropertyDriftHeatmapResult => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.propertyDriftHeatmap(orgId ?? undefined),
    queryFn: async (): Promise<PropertyStatus[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        { id: '1', name: 'Sunrise Tower', status: 'compliant', driftCount: 0 },
        { id: '2', name: 'Harbor View', status: 'compliant', driftCount: 0 },
        { id: '3', name: 'Oak Street Apartments', status: 'pending', driftCount: 2 },
        { id: '4', name: 'Park Plaza', status: 'non_compliant', driftCount: 5 },
        { id: '5', name: 'Downtown Lofts', status: 'compliant', driftCount: 0 },
        { id: '6', name: 'Riverside Complex', status: 'pending', driftCount: 1 },
        { id: '7', name: 'Metro Heights', status: 'compliant', driftCount: 0 },
        { id: '8', name: 'Garden Estates', status: 'non_compliant', driftCount: 3 },
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
