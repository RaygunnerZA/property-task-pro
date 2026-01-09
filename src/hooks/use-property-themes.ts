import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";

type Theme = {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  org_id: string;
};

export function usePropertyThemes(propertyId: string | undefined) {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThemes = useCallback(async () => {
    if (!propertyId || !orgId) {
      setThemes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch themes linked to this property via property_themes junction table
      const { data, error: err } = await supabase
        .from("property_themes")
        .select(`
          theme_id,
          themes (
            id,
            name,
            type,
            color,
            icon,
            parent_id,
            org_id
          )
        `)
        .eq("property_id", propertyId);

      if (err) {
        setError(err.message);
        setThemes([]);
      } else {
        // Extract themes from the join result
        const linkedThemes = (data || [])
          .map((item: any) => item.themes)
          .filter((theme: any) => theme !== null) as Theme[];
        
        setThemes(linkedThemes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch property themes");
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, propertyId, orgId]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const addTheme = useCallback(async (themeId: string) => {
    if (!propertyId || !orgId) return { error: "Missing property ID or org ID" };

    try {
      const { error: err } = await supabase
        .from("property_themes")
        .insert({
          property_id: propertyId,
          theme_id: themeId,
        });

      if (err) {
        // Ignore duplicate key errors
        if (err.code !== "23505") {
          setError(err.message);
          return { error: err };
        }
      }

      // Refresh themes
      await fetchThemes();
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to add theme";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, propertyId, orgId, fetchThemes]);

  const removeTheme = useCallback(async (themeId: string) => {
    if (!propertyId || !orgId) return { error: "Missing property ID or org ID" };

    try {
      const { error: err } = await supabase
        .from("property_themes")
        .delete()
        .eq("property_id", propertyId)
        .eq("theme_id", themeId);

      if (err) {
        setError(err.message);
        return { error: err };
      }

      // Refresh themes
      await fetchThemes();
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to remove theme";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, propertyId, orgId, fetchThemes]);

  return {
    themes,
    loading,
    error,
    refresh: fetchThemes,
    addTheme,
    removeTheme,
  };
}

