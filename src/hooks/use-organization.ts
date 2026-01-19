import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { Tables } from "../integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

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
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for update operations.
 */
export function useOrganization(): UseOrganizationResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching organization
  const { data: organization = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.organisation(orgId ?? undefined),
    queryFn: async (): Promise<Organisation | null> => {
      if (!orgId) {
        return null;
      }

      const { data, error: fetchError } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      return data as Organisation;
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - organization data changes infrequently
    retry: 1,
  });

  // Mutation for updating organization name
  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) {
        throw new Error("No active organization");
      }

      const { error: updateError } = await supabase
        .from("organisations")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch organization after update
      queryClient.invalidateQueries({ queryKey: queryKeys.organisation(orgId ?? undefined) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation function
  const updateName = async (name: string) => {
    await updateNameMutation.mutateAsync(name);
  };

  return {
    organization,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    updateName,
    refresh,
  };
}
