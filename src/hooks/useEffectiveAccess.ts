import { useMemo } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { useOrgBillingStatus } from "@/hooks/useOrgBillingStatus";
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from "@/lib/permissions/effectiveAccess";

/** Resolved permissions for the active org membership. */
export function useEffectiveAccess(): EffectiveAccess & { isLoading: boolean } {
  const { role, assignedProperties, isPrimaryOwner, isLoading: orgLoading } =
    useActiveOrg();
  const { entitlements, loading: entsLoading } = useOrgEntitlements();
  const { billing, loading: billingLoading } = useOrgBillingStatus();

  const access = useMemo(
    () =>
      resolveEffectiveAccess({
        role,
        entitlements,
        assignedPropertyIds: assignedProperties,
        isPrimaryOwner,
        expansionAllowed: billing.expansion_allowed,
      }),
    [role, entitlements, assignedProperties, isPrimaryOwner, billing.expansion_allowed]
  );

  return {
    ...access,
    isLoading: orgLoading || entsLoading || billingLoading,
  };
}
