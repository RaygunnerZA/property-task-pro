import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ThemeRow = Tables<"themes">;

export interface Theme extends ThemeRow {
  // Extended interface if needed
}

export function useThemes(type?: 'category' | 'project' | 'tag' | 'group') {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchThemes = async (): Promise<Theme[]> => {
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
    return (data ?? []) as Theme[];
  };

  const query = useQuery({
    queryKey: ["themes", orgId, type ?? "all"],
    queryFn: fetchThemes,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    themes: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}

