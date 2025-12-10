import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useDataContext } from "@/contexts/DataContext";
import type { Tables } from "../integrations/supabase/types";

type PropertyRow = Tables<"properties">;

export function useProperties() {
  const supabase = useSupabase();
  const { orgId } = useDataContext();
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
      .eq("org_id", orgId);

    if (err) setError(err.message);
    else setProperties(data ?? []);

    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return { properties, loading, error, refresh: fetchProperties };
}
