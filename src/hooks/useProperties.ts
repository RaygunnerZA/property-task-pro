import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type PropertyRow = Tables<"properties">;

export function useProperties() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!orgId) {
      setProperties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("properties")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_archived", false);

    if (err) setError(err.message);
    else setProperties(data ?? []);

    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchProperties();
    }
  }, [fetchProperties, orgLoading]);

  return { properties, loading, error, refresh: fetchProperties };
}
