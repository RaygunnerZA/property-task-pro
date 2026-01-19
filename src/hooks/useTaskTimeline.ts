import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'assignment' | 'comment' | 'attachment';
  description: string;
  author?: string;
  timestamp: Date;
}

/**
 * Hook to fetch task timeline events.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * NOTE: Currently returns empty array as backend service is not yet implemented.
 * This is a placeholder for future timeline functionality.
 * 
 * @param taskId - The task ID to fetch timeline for
 * @returns Timeline events array, loading state, and error state
 */
export function useTaskTimeline(taskId: string) {
  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.taskTimeline(taskId),
    queryFn: async (): Promise<TimelineEvent[]> => {
      // TODO: Connect to backend service
      // For now, return empty array as placeholder
      return [];
    },
    enabled: !!taskId,
    staleTime: 60 * 1000, // 1 minute
    retry: 0, // Don't retry stub implementation
  });

  return { 
    data, 
    loading, 
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null 
  };
}
