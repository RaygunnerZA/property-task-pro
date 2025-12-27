import { useEffect, useState, useCallback } from "react";
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
  const [subscription, setSubscription] = useState<SubscriptionWithTier | null>(null);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!orgId) {
      setSubscription(null);
      setUsage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      setSubscription(
        subData
          ? ({
              ...subData,
              tier,
            } as SubscriptionWithTier)
          : null
      );
      setUsage(usageData || null);
    } catch (err: any) {
      console.error("Error fetching subscription:", err);
      setError(err.message || "Failed to fetch subscription");
      setSubscription(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchSubscription();
    }
  }, [fetchSubscription, orgLoading]);

  const planName = subscription?.tier?.name || "Free Tier";

  return {
    subscription,
    usage,
    loading,
    error,
    planName,
    refresh: fetchSubscription,
  };
}

