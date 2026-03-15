import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type TeamRow = Tables<"teams">;

export function useTeams() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchTeams = async (): Promise<TeamRow[]> => {
    if (!orgId) {
      return [];
    }
    const query = supabase.from("teams").select("*").eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) {
      throw err;
    }
    return data ?? [];
  };

  const query = useQuery({
    queryKey: ["teams", orgId],
    queryFn: fetchTeams,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    teams: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
