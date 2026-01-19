import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

type SpaceRow = Tables<"spaces">;

/**
 * Hook to fetch spaces for the active organization, optionally filtered by property.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param propertyId - Optional property ID to filter spaces
 * @returns Spaces array, loading state, error state, and refresh function
 */
export function useSpaces(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  
  const { data: spaces = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.spaces(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<SpaceRow[]> => {
      if (!orgId) {
        return [];
      }

      let q = supabase.from("spaces").select("*").eq("org_id", orgId);
      if (propertyId) {
        q = q.eq("property_id", propertyId);
      }
      
      const { data, error: err } = await q;
      if (err) {
        throw err;
      }

      return (data ?? []) as SpaceRow[];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 60 * 1000, // 1 minute - spaces change moderately
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    spaces,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
