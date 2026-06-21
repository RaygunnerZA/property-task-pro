import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import {
  acceptOrgStarterTemplateDisclaimer,
  fetchOrgStarterDisclaimerAcceptedAt,
} from "@/services/templates/templateDisclaimerService";

export function useOrgStarterDisclaimer() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["org-starter-disclaimer", orgId],
    queryFn: () => (orgId ? fetchOrgStarterDisclaimerAcceptedAt(orgId) : null),
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });

  const acceptDisclaimer = async (persistForOrg: boolean) => {
    if (!orgId || !persistForOrg) return { error: null as Error | null };
    const result = await acceptOrgStarterTemplateDisclaimer(orgId);
    if (!result.error) {
      await queryClient.invalidateQueries({ queryKey: ["org-starter-disclaimer", orgId] });
    }
    return result;
  };

  return {
    acceptedAt: query.data ?? null,
    hasAccepted: Boolean(query.data),
    loading: orgLoading || query.isLoading,
    acceptDisclaimer,
  };
}
