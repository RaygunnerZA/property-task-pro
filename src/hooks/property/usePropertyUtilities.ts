import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type PropertyUtilityRow = Tables<"property_utilities">;

/**
 * Hook to fetch and manage property utilities.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for create/update/delete operations.
 * 
 * @param propertyId - The property ID to fetch utilities for
 * @returns Utilities array, loading state, error state, refresh function, and mutation functions
 */
export const usePropertyUtilities = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching property utilities
  const { data: utilities = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.propertyUtilities(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyUtilityRow[]> => {
      if (!propertyId || !orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("property_utilities")
        .select("*")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .order("type", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as PropertyUtilityRow[]) ?? [];
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Mutation for creating a utility
  const createUtilityMutation = useMutation({
    mutationFn: async (utility: Omit<PropertyUtilityRow, "id" | "created_at" | "updated_at">) => {
      if (!propertyId || !orgId) {
        throw new Error("Missing property ID or org ID");
      }

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
        throw err;
      }

      return data as PropertyUtilityRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyUtilities(orgId ?? undefined, propertyId) });
    },
  });

  // Mutation for updating a utility
  const updateUtilityMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PropertyUtilityRow> }) => {
      if (!orgId) {
        throw new Error("Missing org ID");
      }

      const { data, error: err } = await supabase
        .from("property_utilities")
        .update(updates)
        .eq("id", id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (err) {
        throw err;
      }

      return data as PropertyUtilityRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyUtilities(orgId ?? undefined, propertyId) });
    },
  });

  // Mutation for deleting a utility
  const deleteUtilityMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) {
        throw new Error("Missing org ID");
      }

      const { error: err } = await supabase
        .from("property_utilities")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyUtilities(orgId ?? undefined, propertyId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation functions
  const createUtility = async (utility: Omit<PropertyUtilityRow, "id" | "created_at" | "updated_at">) => {
    try {
      const data = await createUtilityMutation.mutateAsync(utility);
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create utility";
      return { error: errorMsg };
    }
  };

  const updateUtility = async (id: string, updates: Partial<PropertyUtilityRow>) => {
    try {
      const data = await updateUtilityMutation.mutateAsync({ id, updates });
      return { data, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update utility";
      return { error: errorMsg };
    }
  };

  const deleteUtility = async (id: string) => {
    try {
      await deleteUtilityMutation.mutateAsync(id);
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to delete utility";
      return { error: errorMsg };
    }
  };

  return {
    utilities,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    createUtility,
    updateUtility,
    deleteUtility,
  };
};
