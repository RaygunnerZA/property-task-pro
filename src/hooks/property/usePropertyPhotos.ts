import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyPhoto {
  id: string;
  url: string;
  caption?: string;
  uploaded_at: string;
}

/**
 * Hook to fetch property photos.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch photos for
 * @returns Photos array and loading state
 */
export const usePropertyPhotos = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: photos = [], isLoading } = useQuery({
    queryKey: queryKeys.propertyPhotos(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyPhoto[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        {
          id: '1',
          url: '/placeholder.svg',
          caption: 'Front entrance',
          uploaded_at: '2025-01-15T10:30:00Z'
        },
        {
          id: '2',
          url: '/placeholder.svg',
          caption: 'Living room',
          uploaded_at: '2025-01-15T10:35:00Z'
        },
        {
          id: '3',
          url: '/placeholder.svg',
          caption: 'Kitchen',
          uploaded_at: '2025-01-15T10:40:00Z'
        },
        {
          id: '4',
          url: '/placeholder.svg',
          caption: 'Bedroom',
          uploaded_at: '2025-01-15T10:45:00Z'
        }
      ];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { photos, isLoading };
};
