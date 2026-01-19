import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string;
}

/**
 * Hook to fetch vendor profile data.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param vendorId - The vendor ID to fetch
 * @returns Vendor data and loading state
 */
export const useVendor = (vendorId?: string) => {
  const { data: vendor = null, isLoading } = useQuery({
    queryKey: queryKeys.vendor(vendorId),
    queryFn: async (): Promise<Vendor | null> => {
      if (!vendorId) {
        return null;
      }

      // TODO: Connect to backend service
      // For now, return mock data
      return {
        id: vendorId,
        org_id: 'org-1',
        name: 'ABC Maintenance Co.',
        email: 'contact@abcmaintenance.com',
        phone: '555-0123'
      };
    },
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { vendor, isLoading };
};
