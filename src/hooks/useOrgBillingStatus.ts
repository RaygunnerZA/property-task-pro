import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  DEFAULT_BILLING_STATUS,
  parseBillingStatus,
  type OrgBillingStatus,
} from "@/lib/billing/billingState";

export function useOrgBillingStatus() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["org-billing-status", orgId],
    queryFn: async (): Promise<OrgBillingStatus> => {
      if (!orgId) return { ...DEFAULT_BILLING_STATUS };
      const { data: raw, error: rpcError } = await supabase.rpc(
        "get_org_billing_status",
        { p_org_id: orgId }
      );
      if (rpcError) throw rpcError;
      return parseBillingStatus(raw);
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });

  return {
    billing: data ?? DEFAULT_BILLING_STATUS,
    loading: isLoading || orgLoading,
    error: error ? (error as Error).message : null,
    refresh: () => {
      void refetch();
    },
  };
}
