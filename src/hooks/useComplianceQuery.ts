import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useComplianceQuery(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance", orgId, propertyId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_view")
        .select("*")
        .eq("org_id", orgId)
        .order("expiry_date", { ascending: true, nullsFirst: false });

      // Note: compliance_documents doesn't have property_id, so propertyId filter is not applied
      // if (propertyId) query = query.eq("property_id", propertyId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000, // 1 minute
  });
}

