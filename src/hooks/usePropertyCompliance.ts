import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceRule {
  id: string;
  title: string;
  expiry_state: string | null;
  document_type: string | null;
  next_due_date: string | null;
}

export function usePropertyCompliance(propertyId: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["property-compliance-rules", propertyId, orgId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, expiry_state, document_type, next_due_date")
        .eq("property_id", propertyId)
        .eq("org_id", orgId!);

      if (error) throw error;

      return {
        propertyId,
        rules: (rows ?? []) as ComplianceRule[],
      };
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    compliance: data ?? { propertyId, rules: [] },
    loading: isLoading || orgLoading,
  };
}
