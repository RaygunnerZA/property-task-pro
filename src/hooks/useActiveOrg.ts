import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseActiveOrgResult {
  orgId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and manage the active organization for the current user.
 * 
 * For now, auto-selects the first organization found in organisation_members
 * for the current user. In the future, this will support org switching.
 * 
 * @returns {UseActiveOrgResult} Object containing orgId, isLoading, and error
 */
export function useActiveOrg(): UseActiveOrgResult {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    async function fetchActiveOrg() {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      
      // Prevent concurrent fetches
      if (fetchingRef.current) {
        return;
      }

      // Debounce: Don't fetch if we just fetched in the last 100ms
      if (timeSinceLastFetch < 100) {
        return;
      }

      fetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setIsLoading(true);
      setError(null);

      try {
        console.log('[useActiveOrg] Starting fetchActiveOrg');
        
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('[useActiveOrg] Auth user error:', userError);
          setError(userError.message);
          setOrgId(null);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }

        if (!user) {
          console.warn('[useActiveOrg] No authenticated user found');
          setOrgId(null);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }

        console.log('[useActiveOrg] User found:', { userId: user.id, email: user.email });

        // Fetch the first organisation membership for this user
        console.log('[useActiveOrg] Querying organisation_members for user_id:', user.id);
        const { data: membership, error: membershipsError } = await supabase
          .from("organisation_members")
          .select("org_id")
          .eq("user_id", user.id)
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
          setError(membershipsError.message);
          setOrgId(null);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }

        console.log('[useActiveOrg] Query result:', {
          membership,
          hasMembership: !!membership,
          orgId: membership?.org_id || null
        });

        // Auto-select the first organisation found
        const firstOrgId = membership?.org_id || null;
        
        if (!firstOrgId) {
          console.warn('[useActiveOrg] No org_id found in membership result. Membership data:', membership);
        } else {
          console.log('[useActiveOrg] Found org_id:', firstOrgId);
        }
        
        // Only update if orgId actually changed
        if (firstOrgId !== orgId) {
          console.log('[useActiveOrg] Updating orgId:', { from: orgId, to: firstOrgId });
          setOrgId(firstOrgId);
          lastUserIdRef.current = user.id;
        } else {
          console.log('[useActiveOrg] orgId unchanged:', orgId);
        }
      } catch (err: any) {
        console.error('[useActiveOrg] Unexpected error:', err);
        setError(err.message || "Failed to fetch active organisation");
        setOrgId(null);
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    }

    fetchActiveOrg();

    // Listen for auth state changes to refetch org immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only refetch on SIGNED_IN, NOT on TOKEN_REFRESHED (it fires too often)
      // Only refetch if user actually changed
      if (event === 'SIGNED_IN') {
        const currentUserId = session?.user?.id || null;
        if (currentUserId && currentUserId !== lastUserIdRef.current) {
          fetchActiveOrg();
        }
      }
      // Ignore TOKEN_REFRESHED - it fires too frequently and causes loops
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []); // Empty deps - only run on mount and listen to auth changes

  return { orgId, isLoading, error };
}

