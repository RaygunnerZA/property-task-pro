import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";

type PropertyUtilityRow = Tables<"property_utilities">;

export const usePropertyUtilities = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [utilities, setUtilities] = useState<PropertyUtilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUtilities = useCallback(async () => {
    if (!propertyId || !orgId) {
      setUtilities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("property_utilities")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .order("type", { ascending: true });

      if (err) {
        setError(err.message);
        setUtilities([]);
      } else {
        setUtilities(data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch property utilities");
      setUtilities([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, propertyId, orgId]);

  useEffect(() => {
    fetchUtilities();
  }, [fetchUtilities]);

  const createUtility = useCallback(async (utility: Omit<PropertyUtilityRow, "id" | "created_at" | "updated_at">) => {
    if (!propertyId || !orgId) return { error: "Missing property ID or org ID" };

    try {
      const { data, error: err } = await supabase
        .from("property_utilities")
        .insert({
          ...utility,
          property_id: propertyId,
          org_id: orgId,
        })
        .select()
        .single();

      if (err) {
        setError(err.message);
        return { error: err };
      }

      setUtilities((prev) => [...prev, data]);
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create utility";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, propertyId, orgId]);

  const updateUtility = useCallback(async (id: string, updates: Partial<PropertyUtilityRow>) => {
    if (!orgId) return { error: "Missing org ID" };

    try {
      const { data, error: err } = await supabase
        .from("property_utilities")
        .update(updates)
        .eq("id", id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return { error: err };
      }

      setUtilities((prev) => prev.map((u) => (u.id === id ? data : u)));
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update utility";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, orgId]);

  const deleteUtility = useCallback(async (id: string) => {
    if (!orgId) return { error: "Missing org ID" };

    try {
      const { error: err } = await supabase
        .from("property_utilities")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);

      if (err) {
        setError(err.message);
        return { error: err };
      }

      setUtilities((prev) => prev.filter((u) => u.id !== id));
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to delete utility";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, orgId]);

  return {
    utilities,
    loading,
    error,
    refresh: fetchUtilities,
    createUtility,
    updateUtility,
    deleteUtility,
  };
};

