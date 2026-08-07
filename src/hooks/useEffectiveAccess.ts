import { useMemo } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from "@/lib/permissions/effectiveAccess";

/** Resolved permissions for the active org membership. */
export function useEffectiveAccess(): EffectiveAccess & { isLoading: boolean } {
  const { role, assignedProperties, isPrimaryOwner, isLoading: orgLoading } =
    useActiveOrg();
  const { entitlements, loading: entsLoading } = useOrgEntitlements();

  const access = useMemo(
    () =>
      resolveEffectiveAccess({
        role,
        entitlements,
        assignedPropertyIds: assignedProperties,
        isPrimaryOwner,
      }),
    [role, entitlements, assignedProperties, isPrimaryOwner]
  );

  return {
    ...access,
    isLoading: orgLoading || entsLoading,
  };
}
