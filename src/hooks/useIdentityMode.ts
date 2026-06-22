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
 * Org type and membership role come from `useActiveOrg` (no duplicate queries).
 *
 * Resolution priority:
 * 1. JWT claims (identity_type in app_metadata or user_metadata)
 * 2. Organization membership (org_type and role)
 */
export function useIdentityMode(): UseIdentityModeResult {
  const supabase = useSupabase();
  const { orgId, role, orgType, isLoading: orgLoading } = useActiveOrg();
  const [mode, setMode] = useState<IdentityMode | null>(null);
  const [source, setSource] = useState<IdentityModeSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveMode() {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError) {
          setError(sessionError.message);
          setMode(null);
          setSource(null);
          setIsLoading(false);
          return;
        }

        if (orgLoading) {
          setIsLoading(true);
          return;
        }

        const resolution = resolveIdentityMode(
          session,
          orgType,
          role as "owner" | "manager" | "member" | "staff" | null
        );

        if (cancelled) return;

        setMode(resolution.mode);
        setSource(resolution.source);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to resolve identity mode");
        setMode(null);
        setSource(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void resolveMode();

    return () => {
      cancelled = true;
    };
  }, [supabase, orgId, orgType, role, orgLoading]);

  return {
    mode,
    source,
    isLoading,
    error,
  };
}
