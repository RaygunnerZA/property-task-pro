import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";

interface UseCurrentUserRoleResult {
  role: string | null;
  isLoading: boolean;
  error: string | null;
  isOwner: boolean;
}

/**
 * Hook to get the current user's role in the active organization.
 * 
 * @returns {UseCurrentUserRoleResult} Object containing role, isLoading, error, and isOwner flag
 */
export function useCurrentUserRole(): UseCurrentUserRoleResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
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
        // Get the current user
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

        // Fetch the user's role in the active organization
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
      } catch (err: any) {
        setError(err.message || "Failed to fetch user role");
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserRole();
  }, [supabase, orgId, orgLoading]);

  return {
    role,
    isLoading,
    error,
    isOwner: role === "owner",
  };
}

