import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

type TeamRow = Tables<"teams">;

/**
 * Hook to fetch teams for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Teams array, loading state, error state, and refresh function
 */
export function useTeams() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  
  const { data: teams = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.teams(orgId ?? undefined),
    queryFn: async (): Promise<TeamRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("teams")
        .select("*")
        .eq("org_id", orgId);

      if (err) {
        throw err;
      }

      return (data ?? []) as TeamRow[];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 60 * 1000, // 1 minute - teams change moderately
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    teams,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
