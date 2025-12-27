import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ThemeRow = Tables<"themes">;

export interface Theme extends ThemeRow {
  // Extended interface if needed
}

export function useThemes(type?: 'category' | 'project' | 'tag' | 'group') {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchThemes() {
    if (!orgId) {
      setThemes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from("themes")
      .select("*")
      .eq("org_id", orgId);

    // Filter by type if provided
    if (type) {
      query = query.eq("type", type);
    }

    const { data, error: err } = await query.order("created_at", { ascending: true });

    if (err) setError(err.message);
    else setThemes(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchThemes();
    }
  }, [orgId, orgLoading, type]);

  return { themes, loading, error, refresh: fetchThemes };
}

