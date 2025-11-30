import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";

type PropertyRow = Tables<"properties">;

export function useProperties(orgId?: string) {
  const supabase = useSupabase();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchProperties() {
    setLoading(true);
    setError(null);

    let query = supabase.from("properties").select("*");

    if (orgId) query = query.eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setProperties(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchProperties();
  }, [orgId]);

  return { properties, loading, error, refresh: fetchProperties };
}
