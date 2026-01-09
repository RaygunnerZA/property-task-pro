import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";

type PropertyDetailsRow = Tables<"property_details">;

export const usePropertyDetails = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [details, setDetails] = useState<PropertyDetailsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!propertyId || !orgId) {
      setDetails(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("property_details")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (err) {
        setError(err.message);
        setDetails(null);
      } else {
        setDetails(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch property details");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, propertyId, orgId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const updateDetails = useCallback(async (updates: Partial<PropertyDetailsRow>) => {
    if (!propertyId || !orgId) return { error: "Missing property ID or org ID" };

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("property_details")
        .select("property_id")
        .eq("property_id", propertyId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing
        result = await supabase
          .from("property_details")
          .update(updates)
          .eq("property_id", propertyId)
          .eq("org_id", orgId)
          .select()
          .single();
      } else {
        // Insert new
        result = await supabase
          .from("property_details")
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

      setDetails(result.data);
      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update property details";
      setError(errorMsg);
      return { error: errorMsg };
    }
  }, [supabase, propertyId, orgId]);

  return { details, loading, error, refresh: fetchDetails, updateDetails };
};

