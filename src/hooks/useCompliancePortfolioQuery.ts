import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useCompliancePortfolioQuery() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_portfolio", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_portfolio_view")
        .select("*")
        .eq("org_id", orgId)
        .order("next_due_date", { ascending: true, nullsFirst: false })
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}
