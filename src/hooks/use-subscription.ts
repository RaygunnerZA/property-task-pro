import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { Tables } from "../integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type OrgSubscription = Tables<"org_subscriptions">;
type SubscriptionTier = Tables<"subscription_tiers">;
type OrgUsage = Tables<"org_usage">;

interface SubscriptionWithTier extends OrgSubscription {
  tier: SubscriptionTier | null;
}

interface UseSubscriptionResult {
  subscription: SubscriptionWithTier | null;
  usage: OrgUsage | null;
  loading: boolean;
  error: string | null;
  planName: string;
  refresh: () => void;
}

/**
 * Hook to fetch subscription and usage data for the active organization.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * This hook fetches subscription, tier (if subscription exists), and usage in a single query.
 */
export function useSubscription(): UseSubscriptionResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: queryKeys.subscription(orgId ?? undefined),
    queryFn: async (): Promise<{ subscription: SubscriptionWithTier | null; usage: OrgUsage | null }> => {
      if (!orgId) {
        return { subscription: null, usage: null };
      }

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from("org_subscriptions")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine (no subscription = free tier)
        throw subError;
      }

      // Fetch tier if subscription exists and has plan_id
      let tier: SubscriptionTier | null = null;
      if (subData?.plan_id) {
        const { data: tierData, error: tierError } = await supabase
          .from("subscription_tiers")
          .select("*")
          .eq("id", subData.plan_id)
          .maybeSingle();

        if (!tierError && tierData) {
          tier = tierData;
        }
      }

      // Fetch usage
      const { data: usageData, error: usageError } = await supabase
        .from("org_usage")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      if (usageError && usageError.code !== "PGRST116") {
        throw usageError;
      }

      const subscription: SubscriptionWithTier | null = subData
        ? ({
            ...subData,
            tier,
          } as SubscriptionWithTier)
        : null;

      return {
        subscription,
        usage: usageData || null,
      };
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - subscription data changes infrequently
    retry: 1,
  });

  const subscription = data?.subscription ?? null;
  const usage = data?.usage ?? null;
  const planName = subscription?.tier?.name || "Free Tier";

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    subscription,
    usage,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    planName,
    refresh,
  };
}
