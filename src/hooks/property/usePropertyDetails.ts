import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type PropertyDetailsRow = Tables<"property_details">;

/**
 * Hook to fetch and manage property details.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for update operations.
 * 
 * @param propertyId - The property ID to fetch details for
 * @returns Property details, loading state, error state, refresh function, and update mutation
 */
export const usePropertyDetails = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching property details
  const { data: details = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.propertyDetails(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyDetailsRow | null> => {
      if (!propertyId || !orgId) {
        return null;
      }

      const { data, error: err } = await supabase
        .from("property_details")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (err) {
        throw err;
      }

      return (data as PropertyDetailsRow) || null;
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Mutation for updating property details
  const updateDetailsMutation = useMutation({
    mutationFn: async (updates: Partial<PropertyDetailsRow>) => {
      if (!propertyId || !orgId) {
        throw new Error("Missing property ID or org ID");
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from("property_details")
        .select("property_id")
        .eq("property_id", propertyId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error: err } = await supabase
          .from("property_details")
          .update(updates)
          .eq("property_id", propertyId)
          .eq("org_id", orgId)
          .select()
          .single();

        if (err) {
          throw err;
        }

        return data as PropertyDetailsRow;
      } else {
        // Insert new
        const { data, error: err } = await supabase
          .from("property_details")
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

        return data as PropertyDetailsRow;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch property details after update
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyDetails(orgId ?? undefined, propertyId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation function
  const updateDetails = async (updates: Partial<PropertyDetailsRow>) => {
    try {
      const data = await updateDetailsMutation.mutateAsync(updates);
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update property details";
      return { error: errorMsg };
    }
  };

  return {
    details,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    updateDetails,
  };
};
