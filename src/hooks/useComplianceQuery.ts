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
        .order("next_due_date", { ascending: true, nullsFirst: false })
        .order("expiry_date", { ascending: true, nullsFirst: false });

      if (propertyId) {
        query = query.or(`property_id.eq.${propertyId},property_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000, // 1 minute
  });
}

