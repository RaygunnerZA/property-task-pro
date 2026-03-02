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
  const { data: userData, isLoading: userLoading } = useQuery({
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

    // Fetch all org memberships for this user, joined with org type so we can
    // prefer non-personal orgs (invited organisations rank above personal ones).
    const { data: memberships, error: membershipsError } = await supabase
      .from("organisation_members")
      .select("org_id, created_at, organisations(org_type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      console.error('[useActiveOrg] Query error:', {
        message: membershipsError.message,
        code: membershipsError.code,
        details: membershipsError.details,
        hint: membershipsError.hint,
      });
      throw membershipsError;
    }

    if (!memberships || memberships.length === 0) return null;

    // Prefer the first non-personal org (invited / team org).
    // Falls back to personal org if that's all that exists.
    const nonPersonal = memberships.find(
      (m) => (m.organisations as any)?.org_type !== "personal"
    );
    return (nonPersonal ?? memberships[0]).org_id;
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

  // Fetch active org using TanStack Query.
  // staleTime is intentionally short (10s) rather than Infinity so that after
  // accepting an invitation the app immediately picks up the new org membership.
  // The query is otherwise stable — it only re-fetches on mount / focus / invalidation.
  const { data: orgId, isLoading: orgQueryLoading, error } = useQuery({
    queryKey: ["activeOrg", userId],
    queryFn: fetchActiveOrg,
    enabled: !!userId,
    staleTime: 10_000,
    retry: false,
  });

  return {
    orgId: orgId ?? null,
    // Avoid startup deadlocks: "no user" is a resolved state, not a loading state.
    isLoading: userLoading || (!!userId && orgQueryLoading),
    error: error ? (error as Error).message : null,
  };
}
