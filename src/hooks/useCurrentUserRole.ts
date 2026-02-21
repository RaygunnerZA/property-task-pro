import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { useDevMode } from "@/context/useDevMode";

interface UseCurrentUserRoleResult {
  role: string | null;
  isLoading: boolean;
  error: string | null;
  isOwner: boolean;
  isDevOverride: boolean;
}

/**
 * Hook to get the current user's role in the active organization.
 * 
 * In dev mode, `userRoleOverride` from DevModeContext replaces the
 * real DB role without any auth state mutation.
 */
export function useCurrentUserRole(): UseCurrentUserRoleResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const devMode = useDevMode();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole() {
      if (!orgId || orgLoading) {
        setRole(null);
        setIsLoading(orgLoading);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          setError(userError.message);
          setRole(null);
          setIsLoading(false);
          return;
        }

        if (!user) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("organisation_members")
          .select("role")
          .eq("org_id", orgId)
          .eq("user_id", user.id)
          .single();

        if (membershipError) {
          setError(membershipError.message);
          setRole(null);
        } else {
          setRole(membership?.role || null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch user role");
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserRole();
  }, [supabase, orgId, orgLoading]);

  const effectiveRole =
    import.meta.env.DEV && devMode.enabled && devMode.userRoleOverride
      ? devMode.userRoleOverride
      : role;

  const isDevOverride = !!(
    import.meta.env.DEV &&
    devMode.enabled &&
    devMode.userRoleOverride
  );

  return {
    role: effectiveRole,
    isLoading,
    error,
    isOwner: isDevOverride ? role === "owner" : effectiveRole === "owner",
    isDevOverride,
  };
}

