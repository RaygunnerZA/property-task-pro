import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseActiveOrgResult {
  orgId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and manage the active organization for the current user.
 * 
 * Uses TanStack Query for automatic caching, deduping, and stability.
 * Auto-selects the first organization found in organisation_members
 * for the current user. In the future, this will support org switching.
 * 
 * @returns {UseActiveOrgResult} Object containing orgId, isLoading, and error
 */
export function useActiveOrg(): UseActiveOrgResult {
  const queryClient = useQueryClient();

  // First, get the current user ID
  const { data: userData } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
    staleTime: Infinity, // User ID doesn't change during session
    retry: false,
  });

  const userId = userData?.id;

  // Memoize the fetch function to prevent unnecessary re-renders
  const fetchActiveOrg = useCallback(async () => {
    if (!userId) {
      return null;
    }

    // Fetch the first organisation membership for this user
    const { data: membership, error: membershipsError } = await supabase
      .from("organisation_members")
      .select("org_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipsError) {
      console.error('[useActiveOrg] Query error:', {
        message: membershipsError.message,
        code: membershipsError.code,
        details: membershipsError.details,
        hint: membershipsError.hint
      });
      throw membershipsError;
    }

    // Auto-select the first organisation found
    return membership?.org_id || null;
  }, [userId]);

  // Listen for auth state changes to invalidate queries
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only invalidate on actual sign in/out, not token refresh
      // Token refresh doesn't change the user or org
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Invalidate user query to refetch
        queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
        // Invalidate org query for the new/old user
        queryClient.invalidateQueries({ queryKey: ["activeOrg"] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Fetch active org using TanStack Query
  const { data: orgId, isLoading, error } = useQuery({
    queryKey: ["activeOrg", userId],
    queryFn: fetchActiveOrg,
    enabled: !!userId, // Only fetch when we have a user ID
    staleTime: Infinity, // Org ID rarely changes - cache forever
    retry: false, // Don't retry on error
  });

  return {
    orgId: orgId ?? null,
    isLoading: isLoading || !userId, // Loading if query is loading or no user yet
    error: error ? (error as Error).message : null,
  };
}
