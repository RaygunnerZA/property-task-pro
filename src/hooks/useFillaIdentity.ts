/**
 * Thin convenience hook over `DataContext` identity fields.
 * `orgId` is membership-backed (same resolution as `useActiveOrg`).
 */
import { useDataContext } from "@/contexts/DataContext";

export function useFillaIdentity() {
  const { orgId, userId, contractorToken, isContractor, isOrgUser } = useDataContext();
  return { orgId, userId, contractorToken, isOrgUser, isContractor };
}
