import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type PropertyLegalRow = Tables<"property_legal">;

/**
 * Hook to fetch and manage property legal information.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for update operations.
 * 
 * @param propertyId - The property ID to fetch legal info for
 * @returns Legal data, loading state, error state, refresh function, and update mutation
 */
export const usePropertyLegal = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching property legal info
  const { data: legal = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.propertyLegal(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyLegalRow | null> => {
      if (!propertyId || !orgId) {
        return null;
      }

      const { data, error: err } = await supabase
        .from("property_legal")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (err) {
        throw err;
      }

      return (data as PropertyLegalRow) || null;
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Mutation for updating property legal info
  const updateLegalMutation = useMutation({
    mutationFn: async (updates: Partial<PropertyLegalRow>) => {
      if (!propertyId || !orgId) {
        throw new Error("Missing property ID or org ID");
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from("property_legal")
        .select("property_id")
        .eq("property_id", propertyId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error: err } = await supabase
          .from("property_legal")
          .update(updates)
          .eq("property_id", propertyId)
          .eq("org_id", orgId)
          .select()
          .single();

        if (err) {
          throw err;
        }

        return data as PropertyLegalRow;
      } else {
        // Insert new
        const { data, error: err } = await supabase
          .from("property_legal")
          .insert({
            property_id: propertyId,
            org_id: orgId,
            ...updates,
          })
          .select()
          .single();

        if (err) {
          throw err;
        }

        return data as PropertyLegalRow;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyLegal(orgId ?? undefined, propertyId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation function
  const updateLegal = async (updates: Partial<PropertyLegalRow>) => {
    try {
      const data = await updateLegalMutation.mutateAsync(updates);
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update property legal info";
      return { error: errorMsg };
    }
  };

  return {
    legal,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    updateLegal,
  };
};
