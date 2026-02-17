/**
 * useOrgScope — Single source of truth for org-scoped reads/writes.
 * Wraps useActiveOrg() for consistent consumption across the app.
 *
 * Use in event handlers or guards: requireOrgId() throws when org not ready.
 * Do NOT use requireOrgId() in render paths.
 */
import { useActiveOrg } from "./useActiveOrg";

export interface UseOrgScopeResult {
  orgId: string | null;
  orgLoading: boolean;
  orgError: string | null;
  /** Use only in event handlers or explicit guards. Throws when !orgId && !orgLoading. */
  requireOrgId: () => string;
}

export function useOrgScope(): UseOrgScopeResult {
  const { orgId, isLoading: orgLoading, error: orgError } = useActiveOrg();

  const requireOrgId = (): string => {
    if (orgLoading) {
      throw new Error("Org is still loading");
    }
    if (!orgId) {
      throw new Error("No active organisation");
    }
    return orgId;
  };

  return {
    orgId,
    orgLoading,
    orgError: orgError ?? null,
    requireOrgId,
  };
}
