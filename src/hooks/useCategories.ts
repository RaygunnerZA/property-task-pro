import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type ThemeRow = Tables<"themes">;

/**
 * Hook to fetch categories (themes with type='category') for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Categories array, loading state, error state, and refresh function
 */
export function useCategories() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: categories = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.categories(orgId ?? undefined),
    queryFn: async (): Promise<ThemeRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("themes")
        .select("*")
        .eq("org_id", orgId)
        .eq("type", "category")
        .order("created_at", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as ThemeRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - categories change infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    categories,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

// Note: category_members table was removed in themes migration
// This function is kept for backward compatibility but returns empty array
export function useCategoryMembers(categoryId?: string) {
  return {
    members: [] as any[],
    loading: false,
    error: null as string | null,
    refresh: async () => {},
  };
}

/**
 * Hook to fetch task categories (task_themes with type='category') for a task.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param taskId - The task ID to fetch categories for
 * @returns Task categories array, loading state, error state, and refresh function
 */
export function useTaskCategories(taskId?: string) {
  const { data: taskCategories = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.taskCategories(taskId),
    queryFn: async (): Promise<Tables<"task_themes">[]> => {
      if (!taskId) {
        return [];
      }

      // Use task_themes junction table (replaces task_categories)
      const { data, error: err } = await supabase
        .from("task_themes")
        .select("*")
        .eq("task_id", taskId);

      if (err) {
        throw err;
      }

      return (data as Tables<"task_themes">[]) ?? [];
    },
    enabled: !!taskId, // Only fetch when we have taskId
    staleTime: 2 * 60 * 1000, // 2 minutes - task categories change moderately
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    taskCategories,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
