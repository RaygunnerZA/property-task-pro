import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Loader2, CreditCard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function SettingsBilling() {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const {
    entitlements,
    planLabel,
    usage,
    metrics,
    loading,
    error,
    refresh,
  } = useOrgEntitlements();

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      const { error: refreshError } = await supabase.rpc("refresh_org_usage", {
        p_org_id: orgId,
      });
      if (!cancelled && !refreshError) refresh();
    })();
    return () => {
      cancelled = true;
    };
    // Refresh observed usage once per org open; avoid refetch-identity loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [orgId]);

  if (loading) {
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

  const coordinatingUsed =
    metrics.coordinating_count ??
    0;
  const staffHeadcount = metrics.staff_headcount ?? usage?.staff_count ?? 0;
  const storageUsed = usage?.storage_used_bytes ?? 0;

  return (
    <div className="space-y-4">
      <Card className="shadow-e1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Current Plan</CardTitle>
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
                  ? ` (allowance ${entitlements.staff_active_monthly_allowance}/mo active)`
                  : " (not included on Home)"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Evidence storage</span>
              <span className="text-muted-foreground">
                {formatBytes(storageUsed)} /{" "}
                {formatBytes(entitlements.evidence_bytes_allowance)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
