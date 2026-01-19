import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type Theme = {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  org_id: string;
};

/**
 * Hook to fetch and manage property themes (themes linked to a property).
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for add/remove operations.
 * 
 * @param propertyId - The property ID to fetch themes for
 * @returns Themes array, loading state, error state, refresh function, and mutation functions
 */
export function usePropertyThemes(propertyId: string | undefined) {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching property themes
  const { data: themes = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.propertyThemes(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<Theme[]> => {
      if (!propertyId || !orgId) {
        return [];
      }

      // Fetch themes linked to this property via property_themes junction table
      const { data, error: err } = await supabase
        .from("property_themes")
        .select(`
          theme_id,
          themes (
            id,
            name,
            type,
            color,
            icon,
            parent_id,
            org_id
          )
        `)
        .eq("property_id", propertyId);

      if (err) {
        throw err;
      }

      // Extract themes from the join result
      const linkedThemes = (data || [])
        .map((item: any) => item.themes)
        .filter((theme: any) => theme !== null) as Theme[];

      return linkedThemes;
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Mutation for adding a theme to property
  const addThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      if (!propertyId || !orgId) {
        throw new Error("Missing property ID or org ID");
      }

      const { error: err } = await supabase
        .from("property_themes")
        .insert({
          property_id: propertyId,
          theme_id: themeId,
        });

      // Ignore duplicate key errors (23505)
      if (err && err.code !== "23505") {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyThemes(orgId ?? undefined, propertyId) });
    },
  });

  // Mutation for removing a theme from property
  const removeThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      if (!propertyId || !orgId) {
        throw new Error("Missing property ID or org ID");
      }

      const { error: err } = await supabase
        .from("property_themes")
        .delete()
        .eq("property_id", propertyId)
        .eq("theme_id", themeId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyThemes(orgId ?? undefined, propertyId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation functions
  const addTheme = async (themeId: string) => {
    try {
      await addThemeMutation.mutateAsync(themeId);
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to add theme";
      return { error: errorMsg };
    }
  };

  const removeTheme = async (themeId: string) => {
    try {
      await removeThemeMutation.mutateAsync(themeId);
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to remove theme";
      return { error: errorMsg };
    }
  };

  return {
    themes,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    addTheme,
    removeTheme,
  };
}
