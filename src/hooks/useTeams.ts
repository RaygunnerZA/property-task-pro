import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";

type TeamRow = Tables<"teams">;

export function useTeams(orgId?: string) {
  const supabase = useSupabase();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTeams() {
    setLoading(true);
    setError(null);

    let query = supabase.from("teams").select("*");

    if (orgId) query = query.eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setTeams(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchTeams();
  }, [orgId]);

  return { teams, loading, error, refresh: fetchTeams };
}
