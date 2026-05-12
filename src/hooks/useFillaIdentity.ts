import { useDataContext } from "@/contexts/DataContext";

/**
 * Thin convenience hook over `DataContext` identity fields.
 * `orgId` is membership-backed (same resolution as `useActiveOrg`).
 *
 * @deprecated Prefer `useActiveOrg` / `useOrgScope` for org-scoped queries and guards,
 * and `useOrg` or `useDataContext` when you need bundled context fields. New code should not add imports of this hook.
 */
export function useFillaIdentity() {
  const { orgId, userId, contractorToken, isContractor, isOrgUser } = useDataContext();
  return { orgId, userId, contractorToken, isOrgUser, isContractor };
}
