import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";

type PropertyLegalRow = Tables<"property_legal">;

export const usePropertyLegal = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [legal, setLegal] = useState<PropertyLegalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLegal = useCallback(async () => {
    if (!propertyId || !orgId) {
      setLegal(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("property_legal")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (err) {
        setError(err.message);
        setLegal(null);
      } else {
        setLegal(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch property legal info");
      setLegal(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, propertyId, orgId]);

  useEffect(() => {
    fetchLegal();
  }, [fetchLegal]);

  const updateLegal = useCallback(async (updates: Partial<PropertyLegalRow>) => {
    if (!propertyId || !orgId) return { error: "Missing property ID or org ID" };

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("property_legal")
        .select("property_id")
        .eq("property_id", propertyId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing
        result = await supabase
          .from("property_legal")
          .update(updates)
          .eq("property_id", propertyId)
          .eq("org_id", orgId)
          .select()
          .single();
      } else {
        // Insert new
        result = await supabase
          .from("property_legal")
          .insert({
            property_id: propertyId,
            org_id: orgId,
            ...updates,
          })
          .select()
          .single();
      }

      if (result.error) {
        setError(result.error.message);
        return { error: result.error };
      }

      setLegal(result.data);
      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update property legal info";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, propertyId, orgId]);

  return { legal, loading, error, refresh: fetchLegal, updateLegal };
};

