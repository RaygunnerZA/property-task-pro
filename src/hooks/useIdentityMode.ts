import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import {
  IdentityMode,
  IdentityModeSource,
  resolveIdentityMode,
} from "../utils/identityMode";

/**
 * Result of the useIdentityMode hook.
 */
export interface UseIdentityModeResult {
  mode: IdentityMode | null;
  source: IdentityModeSource | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to resolve and access the current user's identity mode.
 * 
 * Identity mode determines the UX mode the user sees:
 * - personal: User managing their own home
 * - manager: User with owner/manager role in an organization
 * - staff: User with staff role, restricted to assigned properties
 * - contractor: Contractor user with token-based or org access
 * 
 * Resolution priority:
 * 1. JWT claims (identity_type in app_metadata or user_metadata)
 * 2. Organization membership (org_type and role)
 * 
 * @returns {UseIdentityModeResult} Object containing mode, source, isLoading, and error
 */
export function useIdentityMode(): UseIdentityModeResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [mode, setMode] = useState<IdentityMode | null>(null);
  const [source, setSource] = useState<IdentityModeSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveMode() {
      setIsLoading(true);
      setError(null);

      try {
        // Get the current session (contains JWT claims)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          setMode(null);
          setSource(null);
          setIsLoading(false);
          return;
        }

        // If no orgId and still loading, wait
        if (orgLoading) {
          setIsLoading(true);
          return;
        }

        // If we have an orgId, fetch org details and membership
        let orgType: "personal" | "business" | "contractor" | null = null;
        let role: "owner" | "manager" | "member" | "staff" | null = null;

        if (orgId) {
          // Fetch organization to get org_type
          const { data: org, error: orgError } = await supabase
            .from("organisations")
            .select("org_type")
            .eq("id", orgId)
            .single();

          if (orgError && orgError.code !== "PGRST116") {
            // PGRST116 is expected when user isn't a member yet
            console.debug(
              "[useIdentityMode] Could not fetch org (may be expected):",
              orgError
            );
          } else if (org) {
            orgType = org.org_type as "personal" | "business" | "contractor";
          }

          // Fetch user's role in the organization
          if (session?.user?.id) {
            const { data: membership, error: membershipError } = await supabase
              .from("organisation_members")
              .select("role")
              .eq("org_id", orgId)
              .eq("user_id", session.user.id)
              .single();

            if (membershipError && membershipError.code !== "PGRST116") {
              // PGRST116 is expected when user isn't a member yet
              console.debug(
                "[useIdentityMode] Could not fetch membership (may be expected):",
                membershipError
              );
            } else if (membership) {
              role = membership.role as "owner" | "manager" | "member" | "staff";
            }
          }
        }

        // Resolve identity mode using the utility
        const resolution = resolveIdentityMode(session, orgType, role);
        setMode(resolution.mode);
        setSource(resolution.source);
      } catch (err: any) {
        setError(err.message || "Failed to resolve identity mode");
        setMode(null);
        setSource(null);
      } finally {
        setIsLoading(false);
      }
    }

    resolveMode();
  }, [supabase, orgId, orgLoading]);

  return {
    mode,
    source,
    isLoading,
    error,
  };
}
