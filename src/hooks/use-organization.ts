import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { Tables } from "../integrations/supabase/types";

type Organisation = Tables<"organisations">;

interface UseOrganizationResult {
  organization: Organisation | null;
  loading: boolean;
  error: string | null;
  updateName: (name: string) => Promise<void>;
  refresh: () => void;
}

/**
 * Hook to fetch and manage the active organization.
 */
export function useOrganization(): UseOrganizationResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [organization, setOrganization] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    if (!orgId) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (fetchError) throw fetchError;
      setOrganization(data);
    } catch (err: any) {
      console.error("Error fetching organization:", err);
      setError(err.message || "Failed to fetch organization");
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, orgId]);

  const updateName = useCallback(
    async (name: string) => {
      if (!orgId) {
        throw new Error("No active organization");
      }

      setError(null);
      try {
        const { error: updateError } = await supabase
          .from("organisations")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", orgId);

        if (updateError) throw updateError;
        await fetchOrganization(); // Refresh after update
      } catch (err: any) {
        console.error("Error updating organization name:", err);
        setError(err.message || "Failed to update organization name");
        throw err;
      }
    },
    [supabase, orgId, fetchOrganization]
  );

  useEffect(() => {
    if (!orgLoading) {
      fetchOrganization();
    }
  }, [fetchOrganization, orgLoading]);

  return {
    organization,
    loading,
    error,
    updateName,
    refresh: fetchOrganization,
  };
}

