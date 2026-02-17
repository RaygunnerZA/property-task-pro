// Thin wrapper around useActiveOrg for organisation ID
// Maintains backward compatibility with existing imports
import { useActiveOrg } from "@/hooks/useActiveOrg";

export function useOrganisationId() {
  const { orgId } = useActiveOrg();
  return orgId;
}
