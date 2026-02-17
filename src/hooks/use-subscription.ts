import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { Tables } from "../integrations/supabase/types";

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
 */
export function useSubscription(): UseSubscriptionResult {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription", orgId],
    queryFn: async () => {
      if (!orgId) return { subscription: null, usage: null };

      const { data: subData, error: subError } = await supabase
        .from("org_subscriptions")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        throw subError;
      }

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

      const { data: usageData, error: usageError } = await supabase
        .from("org_usage")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      if (usageError && usageError.code !== "PGRST116") {
        throw usageError;
      }

      const subscription: SubscriptionWithTier | null = subData
        ? ({ ...subData, tier } as SubscriptionWithTier)
        : null;

      return {
        subscription,
        usage: usageData || null,
      };
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 300000,
  });

  const subscription = data?.subscription ?? null;
  const usage = data?.usage ?? null;
  const planName = subscription?.tier?.name || "Free Tier";

  return {
    subscription,
    usage,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    planName,
    refresh: () => refetch(),
  };
}
