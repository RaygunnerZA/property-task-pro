import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyVendorActivity {
  vendorName: string;
  lastVisit: string;
  tasksCompleted: number;
}

/**
 * Hook to fetch property vendor activity.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch vendor activity for
 * @returns Vendor activity array and loading state
 */
export const usePropertyVendors = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: vendorActivity = [], isLoading } = useQuery({
    queryKey: queryKeys.propertyVendors(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyVendorActivity[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        {
          vendorName: 'Alpine Maintenance Co.',
          lastVisit: '2025-01-15',
          tasksCompleted: 3
        },
        {
          vendorName: 'SafeGuard Inspections',
          lastVisit: '2025-01-10',
          tasksCompleted: 1
        }
      ];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { vendorActivity, isLoading };
};
