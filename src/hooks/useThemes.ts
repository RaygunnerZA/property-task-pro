import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type ThemeRow = Tables<"themes">;

export interface Theme extends ThemeRow {
  // Extended interface if needed
}

/**
 * Hook to fetch themes (categories, projects, tags, groups) for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param type - Optional type filter ('category', 'project', 'tag', 'group')
 * @returns Themes array, loading state, error state, and refresh function
 */
export function useThemes(type?: 'category' | 'project' | 'tag' | 'group') {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: themes = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.themes(orgId ?? undefined, type),
    queryFn: async (): Promise<Theme[]> => {
      if (!orgId) {
        return [];
      }

      let query = supabase
        .from("themes")
        .select("*")
        .eq("org_id", orgId);

      // Filter by type if provided
      if (type) {
        query = query.eq("type", type);
      }

      const { data, error: err } = await query.order("created_at", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as Theme[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - themes change infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    themes,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
