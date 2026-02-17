// Thin wrapper for identity state: orgId from useActiveOrg, session/contractor from DataContext
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "./useActiveOrg";

export function useFillaIdentity() {
  const { userId, contractorToken, isContractor } = useDataContext();
  const { orgId } = useActiveOrg();

  return {
    orgId,
    userId,
    contractorToken,
    isOrgUser: !!orgId && !!userId,
    isContractor,
  };
}
