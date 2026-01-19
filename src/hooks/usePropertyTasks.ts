import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

interface PropertyTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue?: boolean;
}

interface Property {
  id: string;
  address: string;
  nickname?: string;
}

/**
 * Hook to fetch tasks for a specific property.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns empty array as backend service is not yet fully implemented.
 * This is a placeholder for future property-task relationship functionality.
 * 
 * @param propertyId - The property ID to fetch tasks for
 * @returns Tasks array, property info, and loading state
 */
export function usePropertyTasks(propertyId: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.propertyTasks(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyTask[]> => {
      // TODO: Connect to backend service
      // For now, return empty array as placeholder
      return [];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 60 * 1000, // 1 minute
    retry: 0, // Don't retry stub implementation
  });

  // Property info would come from a separate query or prop
  const property: Property | null = null;

  return { data: tasks, property, loading };
}
