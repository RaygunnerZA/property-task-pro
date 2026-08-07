import { useMemo } from "react";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { aiQuotaWarning, AI_OPS_PACK_UNITS } from "@/lib/ai/costUnits";

export function useAiQuota() {
  const { entitlements, metrics, loading, refresh } = useOrgEntitlements();

  const used = metrics.ai_ops_used ?? 0;
  const allowance = entitlements.ai_ops_allowance;
  const messagingUsed = metrics.messaging_units_used ?? 0;
  const messagingAllowance = entitlements.premium_messaging_allowance;

  const warning = useMemo(
    () => aiQuotaWarning(used, allowance),
    [used, allowance]
  );

  return {
    used,
    allowance,
    warning,
    packUnits: AI_OPS_PACK_UNITS,
    messagingUsed,
    messagingAllowance,
    loading,
    refresh,
    usageRatio: allowance > 0 ? used / allowance : 0,
    isExhausted: allowance > 0 && used >= allowance,
    messagingEnabled: messagingAllowance > 0,
  };
}
