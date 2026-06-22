import { useActiveOrg } from "./useActiveOrg";
import { useDevMode } from "@/context/useDevMode";
import { isDevBuild } from "@/context/DevModeContext";

interface UseCurrentUserRoleResult {
  role: string | null;
  isLoading: boolean;
  error: string | null;
  isOwner: boolean;
  isDevOverride: boolean;
}

/**
 * Current user's role in the active organization.
 * Role is sourced from `useActiveOrg` (one membership query for the whole app).
 *
 * In dev mode, `userRoleOverride` from DevModeContext replaces the
 * real DB role without any auth state mutation.
 */
export function useCurrentUserRole(): UseCurrentUserRoleResult {
  const { role, isLoading, error } = useActiveOrg();
  const devMode = useDevMode();

  const effectiveRole =
    isDevBuild && devMode.enabled && devMode.userRoleOverride
      ? devMode.userRoleOverride
      : role;

  const isDevOverride = !!(
    isDevBuild &&
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
