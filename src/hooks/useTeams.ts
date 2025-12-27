import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type TeamRow = Tables<"teams">;

export function useTeams() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTeams() {
    if (!orgId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const query = supabase.from("teams").select("*").eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setTeams(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchTeams();
    }
  }, [orgId, orgLoading]);

  return { teams, loading, error, refresh: fetchTeams };
}
