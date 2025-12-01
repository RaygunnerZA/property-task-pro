// Thin wrapper around DataContext for identity state
// Maintains backward compatibility with existing imports
import { useDataContext } from "@/contexts/DataContext";

export function useFillaIdentity() {
  const { orgId, userId, contractorToken, isOrgUser, isContractor } = useDataContext();
  
  return {
    orgId,
    userId,
    contractorToken,
    isOrgUser,
    isContractor
  };
}
