import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useAssetComplianceQuery(assetId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["asset_compliance", orgId, assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_portfolio_view")
        .select("*")
        .eq("org_id", orgId)
        .contains("linked_asset_ids", assetId ? [assetId] : []);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!assetId && !orgLoading,
    staleTime: 60000,
  });
}
