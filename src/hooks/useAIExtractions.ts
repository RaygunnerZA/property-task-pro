import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type AIExtractionRow = Tables<"ai_extractions">;
type AIModelRow = Tables<"ai_models">;

/**
 * Hook to fetch AI extractions for a task or all tasks in an org.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param taskId - Optional task ID to filter extractions. If not provided, fetches all extractions for the org.
 * @returns Extractions array, loading state, error state, and refresh function
 */
export function useAIExtractions(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: extractions = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.aiExtractions(orgId ?? undefined, taskId),
    queryFn: async (): Promise<AIExtractionRow[]> => {
      if (!orgId) {
        return [];
      }

      let query = supabase
        .from("ai_extractions")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (taskId) {
        query = query.eq("task_id", taskId);
      }

      const { data, error: err } = await query;

      if (err) {
        throw err;
      }

      return (data as AIExtractionRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 2 * 60 * 1000, // 2 minutes - AI extractions change less frequently
    retry: 1, // Retry once on error
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    extractions,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

/**
 * Hook to fetch the latest AI extraction for a task.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param taskId - The task ID to fetch the latest extraction for
 * @returns Latest extraction, loading state, error state, and refresh function
 */
export function useLatestAIExtraction(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: extraction, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.latestAIExtraction(orgId ?? undefined, taskId),
    queryFn: async (): Promise<AIExtractionRow | null> => {
      if (!orgId || !taskId) {
        return null;
      }

      const { data, error: err } = await supabase
        .from("ai_extractions")
        .select("*")
        .eq("org_id", orgId)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) {
        throw err;
      }

      return (data as AIExtractionRow) || null;
    },
    enabled: !!orgId && !!taskId && !orgLoading, // Only fetch when we have orgId and taskId
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    extraction,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

/**
 * Hook to fetch all AI models.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns AI models array, loading state, error state, and refresh function
 */
export function useAIModels() {
  const { data: models = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.aiModels(),
    queryFn: async (): Promise<AIModelRow[]> => {
      const { data, error: err } = await supabase
        .from("ai_models")
        .select("*")
        .order("name", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as AIModelRow[]) ?? [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - models change very infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    models,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
