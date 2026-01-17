import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type TeamRow = Tables<"teams">;

export function useTeams() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const query = useQuery({
    queryKey: ["org", orgId, "teams"],
    queryFn: async () => {
      if (!orgId) return [] as TeamRow[];
      const { data, error } = await supabase.from("teams").select("*").eq("org_id", orgId);
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    teams: (query.data ?? []) as TeamRow[],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
}
