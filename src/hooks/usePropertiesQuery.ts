import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { fetchOrgPropertiesList } from "@/services/properties/fetchOrgProperties";
import { filterPropertiesByScope, resolveEffectiveAccess } from "@/lib/permissions/effectiveAccess";

export function usePropertiesQuery() {
  const { orgId, role, assignedProperties, isPrimaryOwner, isLoading: orgLoading } =
    useActiveOrg();

  return useQuery({
    queryKey: ["properties", orgId, role, assignedProperties, isPrimaryOwner],
    queryFn: async () => {
      const rows = await fetchOrgPropertiesList(orgId as string);
      const access = resolveEffectiveAccess({
        role,
        assignedPropertyIds: assignedProperties,
        isPrimaryOwner,
      });
      return filterPropertiesByScope(rows, access);
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
    retry: 1,
  });
}
