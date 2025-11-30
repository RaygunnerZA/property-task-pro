import { useOrganisationId } from "../state/useOrganisationId";
import { useUserId } from "./useUserId";
import { useContractorToken } from "./useContractorToken";

export function useFillaIdentity() {
  const orgId = useOrganisationId();
  const userId = useUserId();
  const contractorToken = useContractorToken();

  const isOrgUser = !!orgId && !!userId;
  const isContractor = !!contractorToken && !orgId;

  return {
    orgId,
    userId,
    contractorToken,
    isOrgUser,
    isContractor
  };
}
