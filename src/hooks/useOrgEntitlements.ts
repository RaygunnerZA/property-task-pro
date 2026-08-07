import { useMemo } from "react";
import { useSubscription } from "@/hooks/use-subscription";
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
 * Resolved org entitlements (Home defaults when no subscription).
 * Never branch on plan display names in feature code — use keys via `has` / `allowance`.
 */
export function useOrgEntitlements(): UseOrgEntitlementsResult {
  const { subscription, usage, loading, error, refresh } = useSubscription();

  const entitlements = useMemo(
    () => mergeEntitlements(subscription?.tier?.entitlements ?? null),
    [subscription?.tier?.entitlements]
  );

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
    loading,
    error,
    refresh,
    has: (key) => hasEntitlement(entitlements, key),
    allowance: (key) => getAllowance(entitlements, key),
  };
}
