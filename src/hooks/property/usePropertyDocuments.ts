import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

export interface PropertyDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  url?: string;
}

/**
 * Hook to fetch property documents.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns mock data. Backend service implementation pending.
 * 
 * @param propertyId - The property ID to fetch documents for
 * @returns Documents array and loading state
 */
export const usePropertyDocuments = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: queryKeys.propertyDocuments(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyDocument[]> => {
      // TODO: Connect to backend service
      // For now, return mock data
      return [
        {
          id: '1',
          name: 'Lease Agreement.pdf',
          size: 2048000,
          type: 'application/pdf',
          uploaded_at: '2025-01-10T09:00:00Z'
        },
        {
          id: '2',
          name: 'Fire Safety Certificate.pdf',
          size: 1024000,
          type: 'application/pdf',
          uploaded_at: '2025-01-12T14:30:00Z'
        },
        {
          id: '3',
          name: 'Property Inspection Report.pdf',
          size: 3072000,
          type: 'application/pdf',
          uploaded_at: '2025-01-14T11:15:00Z'
        }
      ];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 0, // Don't retry mock implementation
  });

  return { documents, isLoading };
};
