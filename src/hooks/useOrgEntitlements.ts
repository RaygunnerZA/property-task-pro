import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubscription } from "@/hooks/use-subscription";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import {
  getAllowance,
  hasEntitlement,
  mergeEntitlements,
  resolvePlanLabel,
  type OrgEntitlements,
  type OrgUsageMetrics,
} from "@/lib/entitlements";

export type UseOrgEntitlementsResult = {
  entitlements: OrgEntitlements;
  planLabel: string;
  usage: ReturnType<typeof useSubscription>["usage"];
  metrics: OrgUsageMetrics;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  has: (key: keyof OrgEntitlements) => boolean;
  allowance: (key: keyof OrgEntitlements) => number;
};

/**
 * Resolved org entitlements via get_org_entitlements (includes add-ons + overrides).
 * Falls back to client merge of tier JSON if the RPC is unavailable.
 * Never branch on plan display names in feature code — use keys via `has` / `allowance`.
 */
export function useOrgEntitlements(): UseOrgEntitlementsResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { subscription, usage, loading: subLoading, error, refresh } = useSubscription();

  const {
    data: rpcEntitlements,
    isLoading: rpcLoading,
    refetch: refetchRpc,
  } = useQuery({
    queryKey: ["org-entitlements-rpc", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error: rpcError } = await supabase.rpc("get_org_entitlements", {
        p_org_id: orgId,
      });
      if (rpcError) throw rpcError;
      return mergeEntitlements(data);
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });

  const entitlements = useMemo((): OrgEntitlements => {
    if (rpcEntitlements) return rpcEntitlements;

    // Fallback: tier JSON + client-side add-ons (pre-Phase-6 / RPC failure)
    const merged = mergeEntitlements(subscription?.tier?.entitlements ?? null);
    const seatAddon = subscription?.seat_count ?? 0;
    const storageAddon = subscription?.storage_addon_bytes ?? 0;
    const aiAddon = subscription?.ai_addon_ops ?? 0;
    const msgAddon = subscription?.messaging_addon_units ?? 0;
    let next = merged;
    if (seatAddon > 0) {
      next = {
        ...next,
        coordinating_seats_limit: next.coordinating_seats_limit + seatAddon,
      };
    }
    if (storageAddon > 0) {
      next = {
        ...next,
        evidence_bytes_allowance: next.evidence_bytes_allowance + storageAddon,
      };
    }
    if (aiAddon > 0) {
      next = {
        ...next,
        ai_ops_allowance: next.ai_ops_allowance + aiAddon,
      };
    }
    if (msgAddon > 0) {
      next = {
        ...next,
        premium_messaging_allowance: next.premium_messaging_allowance + msgAddon,
      };
    }
    return next;
  }, [
    rpcEntitlements,
    subscription?.tier?.entitlements,
    subscription?.seat_count,
    subscription?.storage_addon_bytes,
    subscription?.ai_addon_ops,
    subscription?.messaging_addon_units,
  ]);

  const planLabel = resolvePlanLabel(
    subscription?.tier?.name,
    !!subscription
  );

  const metrics = useMemo((): OrgUsageMetrics => {
    const raw = (usage as { metrics?: unknown } | null)?.metrics;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as OrgUsageMetrics;
    }
    return {};
  }, [usage]);

  return {
    entitlements,
    planLabel,
    usage,
    metrics,
    loading: subLoading || rpcLoading,
    error: error ? error : null,
    refresh: () => {
      refresh();
      void refetchRpc();
    },
    has: (key) => hasEntitlement(entitlements, key),
    allowance: (key) => getAllowance(entitlements, key),
  };
}
