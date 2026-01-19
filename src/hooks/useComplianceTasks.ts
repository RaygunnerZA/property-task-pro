import { useQuery } from '@tanstack/react-query';
import { useActiveOrg } from './useActiveOrg';
import { queryKeys } from '@/lib/queryKeys';

interface ComplianceTask {
  id: string;
  title: string;
  description?: string;
  propertyName: string;
  ruleName: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue: boolean;
  isDueToday: boolean;
  slaStatus: 'on-track' | 'at-risk' | 'breached';
}

/**
 * Hook to fetch compliance tasks.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns empty array as backend service is not yet fully implemented.
 * This is a placeholder for future compliance task functionality.
 * 
 * @returns Compliance tasks array and loading state
 */
export function useComplianceTasks() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.complianceTasks(orgId ?? undefined),
    queryFn: async (): Promise<ComplianceTask[]> => {
      // TODO: Connect to backend service
      // For now, return empty array as placeholder
      return [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60 * 1000, // 1 minute
    retry: 0, // Don't retry stub implementation
  });

  return { data, loading };
}
