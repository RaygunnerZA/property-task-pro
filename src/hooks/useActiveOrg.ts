import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useContext, createContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSession, subscribeToSession } from "@/lib/sessionManager";

export interface UseActiveOrgResult {
  orgId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Create a default context that always returns undefined
// This ensures useContext is always called (Rules of Hooks)
const DefaultActiveOrgContext = createContext<UseActiveOrgResult | undefined>(undefined);

// Lazy load the actual context from provider (for optimization)
let ActiveOrgContext: React.Context<UseActiveOrgResult | undefined> | null = null;

function getActiveOrgContext() {
  if (!ActiveOrgContext) {
    try {
      // Dynamic import to break circular dependency
      const module = require("@/providers/ActiveOrgProvider");
      ActiveOrgContext = module.ActiveOrgContext;
    } catch {
      // Provider not available, use default context
      ActiveOrgContext = DefaultActiveOrgContext;
    }
  }
  return ActiveOrgContext || DefaultActiveOrgContext;
}

/**
 * Internal implementation - runs the actual query logic.
 * Exported for use by ActiveOrgProvider to avoid circular dependencies.
 */
export function useActiveOrgInternal(): UseActiveOrgResult {
  const queryClient = useQueryClient();

  // First, get the current user ID
  const { data: userData } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      // SessionManager is the single source of truth for session reads.
      const session = await getSession();
      return session?.user ?? null;
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
    const firstOrgId = membership?.org_id || null;
    
    if (firstOrgId) {
      console.log('[useActiveOrg] Found org_id:', firstOrgId);
    }
    
    return firstOrgId;
  }, [userId]);

  // Listen for auth state changes to invalidate queries
  useEffect(() => {
    return subscribeToSession((_session) => {
      // Session changes can affect the user/org.
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      queryClient.invalidateQueries({ queryKey: ["activeOrg"] });
    });
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

/**
 * Hook to fetch and manage the active organization for the current user.
 * 
 * OPTIMIZATION: If ActiveOrgProvider is used at the root, this hook will prefer
 * the context value over running its own query, eliminating redundant calls.
 * This is backwards compatible - if context is not available, it falls back
 * to the query implementation.
 * 
 * Uses TanStack Query for automatic caching, deduping, and stability.
 * Auto-selects the first organization found in organisation_members
 * for the current user. In the future, this will support org switching.
 * 
 * @returns {UseActiveOrgResult} Object containing orgId, isLoading, and error
 */
export function useActiveOrg(): UseActiveOrgResult {
  // OPTIMIZATION: Check for context first - if provided, use it instead of querying
  // Always call useContext (required by Rules of Hooks) with the appropriate context
  const context = getActiveOrgContext();
  const contextValue = useContext(context);
  
  // If context provides a value (not undefined), use it
  if (contextValue !== undefined) {
    return contextValue;
  }

  // Fallback: Run the query if context is not available (backwards compatible)
  return useActiveOrgInternal();
}
