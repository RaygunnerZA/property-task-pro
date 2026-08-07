import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { filterPropertiesByScope, resolveEffectiveAccess } from "@/lib/permissions/effectiveAccess";

export function usePropertiesQuery() {
  const { orgId, role, assignedProperties, isPrimaryOwner, isLoading: orgLoading } =
    useActiveOrg();

  return useQuery({
    queryKey: ["properties", orgId, role, assignedProperties, isPrimaryOwner],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties_view")
        .select("*")
        .eq("org_id", orgId);

      if (error) throw error;
      const rows = data ?? [];
      const access = resolveEffectiveAccess({
        role,
        assignedPropertyIds: assignedProperties,
        isPrimaryOwner,
      });
      // Defense-in-depth: RLS also scopes; client filters assigned lists.
      return filterPropertiesByScope(rows, access);
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}
