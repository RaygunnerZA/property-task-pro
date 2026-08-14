import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { useOrgBillingStatus } from "@/hooks/useOrgBillingStatus";
import { useBillingActions } from "@/hooks/useBillingActions";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { BillingStatusBanner } from "@/components/billing/BillingStatusBanner";
import { PlanComparison } from "@/components/billing/PlanComparison";
import { DowngradePropertyPicker } from "@/components/billing/DowngradePropertyPicker";
import { EvidenceUsageCard } from "@/components/billing/EvidenceUsageCard";
import { AiUsageCard } from "@/components/billing/AiUsageCard";
import { GovernanceCard } from "@/components/billing/GovernanceCard";
import { Loader2, CreditCard, TrendingUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PlanTierId } from "@/lib/billing/planCatalog";
import { formatEvidenceBytes } from "@/lib/evidence/uploadLimits";

export default function SettingsBilling() {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    entitlements,
    planLabel,
    usage,
    metrics,
    loading,
    error,
    refresh,
  } = useOrgEntitlements();
  const { billing, loading: billingLoading, refresh: refreshBilling } =
    useOrgBillingStatus();
  const { busy, startCheckout, openBillingPortal, archiveExcept } =
    useBillingActions();
  const { data: properties = [] } = useQuery({
    queryKey: ["billing-properties", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error: qError } = await supabase
        .from("properties")
        .select("id, nickname, address, is_archived")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });
      if (qError) throw qError;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      const { error: refreshError } = await supabase.rpc("refresh_org_usage", {
        p_org_id: orgId,
      });
      if (!cancelled && !refreshError) {
        refresh();
        refreshBilling();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once per org
  }, [orgId]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Checkout complete", {
        description: "Your plan will update shortly after Stripe confirms payment.",
      });
      refresh();
      refreshBilling();
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    } else if (checkout === "cancel") {
      toast.message("Checkout cancelled");
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL handling
  }, []);

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => ({
        id: p.id,
        label: p.nickname?.trim() || p.address || "Property",
        isArchived: !!p.is_archived,
      })),
    [properties]
  );

  if (loading || billingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-e1">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const propertyLimit = entitlements.active_properties_limit;
  const propertiesUsed = usage?.property_count ?? 0;
  const usagePercentage =
    propertyLimit > 0
      ? Math.min((propertiesUsed / propertyLimit) * 100, 100)
      : 0;

  const coordinatingUsed = metrics.coordinating_count ?? 0;
  const staffHeadcount = metrics.staff_headcount ?? usage?.staff_count ?? 0;
  const storageUsed = usage?.storage_used_bytes ?? 0;
  const currentPlanId = billing.plan_id ?? (planLabel === "Home" ? "home" : null);
  const hasStripeSubscription = !!billing.stripe_subscription_id;

  async function handleSelectPlan(tierId: PlanTierId) {
    const result = await startCheckout({ tierId });
    if (result.usePortal) {
      await openBillingPortal();
      return;
    }
    if (result.error) {
      toast.error("Could not start checkout", { description: result.error });
    }
  }

  async function handleManageBilling() {
    const result = await openBillingPortal();
    if (result.error) {
      toast.error("Could not open billing portal", { description: result.error });
    }
  }

  async function handleDowngradeArchive(keepIds: string[]) {
    const result = await archiveExcept(keepIds);
    if (result.error) {
      toast.error("Could not update properties", { description: result.error });
      return;
    }
    toast.success(
      result.archived
        ? `${result.archived} propert${result.archived === 1 ? "y" : "ies"} soft-archived`
        : "Active properties updated"
    );
    refresh();
  }

  async function handleBuyStoragePack() {
    const result = await startCheckout({
      mode: "storage_addon",
      storagePackQuantity: 1,
    });
    if (result.usePortal) {
      await openBillingPortal();
      return;
    }
    if (result.error) {
      toast.error("Could not start storage pack checkout", {
        description: result.error,
      });
    }
  }

  async function handleBuyAiPack() {
    const result = await startCheckout({
      mode: "ai_addon",
      aiPackQuantity: 1,
    });
    if (result.usePortal) {
      await openBillingPortal();
      return;
    }
    if (result.error) {
      toast.error("Could not start AI pack checkout", {
        description: result.error,
      });
    }
  }

  return (
    <div className="space-y-4">
      <BillingStatusBanner
        billing={billing}
        onManageBilling={() => void handleManageBilling()}
        busy={busy}
      />

      <Card className="shadow-e1">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Current Plan</CardTitle>
            </div>
            {hasStripeSubscription && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void handleManageBilling()}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Manage subscription
              </Button>
            )}
          </div>
          <CardDescription>
            Capabilities come from entitlements — not plan display names
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Plan</span>
              <span className="text-lg font-bold text-primary">{planLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Billing state</span>
              <span className="font-medium capitalize">{billing.state.replace("_", " ")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Staff collaboration</span>
              <span className="font-medium">
                {entitlements.can_add_staff ? "Included" : "Upgrade to Home Plus"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Multi-property</span>
              <span className="font-medium">
                {entitlements.multi_property_enabled ? "Enabled" : "Home / Home Plus"}
              </span>
            </div>
            {billing.seat_addon > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seat add-ons</span>
                <span className="font-medium">+{billing.seat_addon}</span>
              </div>
            )}
            {billing.current_period_end && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {billing.cancel_at_period_end ? "Ends" : "Renews"}
                </span>
                <span className="font-medium">
                  {new Date(billing.current_period_end).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-e1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Usage</CardTitle>
          </div>
          <CardDescription>
            Observed organisation usage vs plan allowances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Active properties</span>
                <span className="text-muted-foreground">
                  {propertiesUsed} / {propertyLimit}
                </span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    usagePercentage >= 90
                      ? "bg-destructive"
                      : usagePercentage >= 75
                        ? "bg-warning"
                        : "bg-primary"
                  )}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              {usagePercentage >= 100 && (
                <p className="text-xs text-destructive">
                  Property limit reached. Upgrade to Portfolio to add another property.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Coordinating seats</span>
              <span className="text-muted-foreground">
                {coordinatingUsed} / {entitlements.coordinating_seats_limit}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Staff headcount</span>
              <span className="text-muted-foreground">
                {staffHeadcount}
                {entitlements.staff_active_monthly_allowance > 0
                  ? ` (allowance ${entitlements.staff_active_monthly_allowance}/mo active — observe)`
                  : " (not included on Home)"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Evidence storage</span>
              <span className="text-muted-foreground">
                {formatEvidenceBytes(storageUsed)} /{" "}
                {formatEvidenceBytes(entitlements.evidence_bytes_allowance)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <EvidenceUsageCard
        propertyLabels={propertyOptions.map((p) => ({
          id: p.id,
          label: p.label,
        }))}
        busy={busy}
        onBuyStoragePack={() => void handleBuyStoragePack()}
      />

      <AiUsageCard
        busy={busy}
        onBuyAiPack={() => void handleBuyAiPack()}
      />

      <GovernanceCard />

      <DowngradePropertyPicker
        properties={propertyOptions}
        maxActive={propertyLimit}
        busy={busy}
        onConfirm={handleDowngradeArchive}
      />

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Plans</h2>
        <p className="text-xs text-muted-foreground">
          Properties and coordinating members first. Storage and AI allowances are secondary.
          Checkout requires Stripe price secrets on the edge functions.
        </p>
        <PlanComparison
          currentPlanId={currentPlanId}
          hasStripeSubscription={hasStripeSubscription}
          busy={busy}
          onSelectPlan={(id) => void handleSelectPlan(id)}
          onManageExisting={() => void handleManageBilling()}
        />
      </div>

      {!hasStripeSubscription && entitlements.can_add_staff && (
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base">Seat add-ons</CardTitle>
            <CardDescription>
              Need more Owner/Manager seats without changing property band?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void startCheckout({ mode: "seat_addon", seatQuantity: 1 }).then((r) => {
                  if (r.usePortal) void openBillingPortal();
                  else if (r.error) {
                    toast.error("Could not start seat checkout", {
                      description: r.error,
                    });
                  }
                })
              }
            >
              Add coordinating seat
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
