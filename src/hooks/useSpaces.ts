import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";

type SpaceRow = Tables<"spaces">;

export function useSpaces(propertyId?: string) {
  const supabase = useSupabase();
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchSpaces() {
    setLoading(true);
    setError(null);

    let query = supabase.from("spaces").select("*");

    if (propertyId) query = query.eq("property_id", propertyId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setSpaces(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchSpaces();
  }, [propertyId]);

  return { spaces, loading, error, refresh: fetchSpaces };
}
