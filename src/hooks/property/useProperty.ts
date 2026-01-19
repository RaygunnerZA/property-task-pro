import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/integrations/supabase/useSupabase';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import type { Tables } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';

type PropertyRow = Tables<"properties">;

/**
 * Hook to fetch a single property by ID.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param propertyId - The property ID to fetch
 * @returns Property data, loading state, error state, and refresh function
 */
export const useProperty = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: property = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.property(orgId ?? undefined, propertyId),
    queryFn: async (): Promise<PropertyRow | null> => {
      if (!propertyId || !orgId) {
        return null;
      }

      const { data, error: err } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("org_id", orgId)
        .single();

      if (err) {
        throw err;
      }

      return (data as PropertyRow) || null;
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes - properties change infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return { 
    property, 
    loading, 
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh 
  };
};
