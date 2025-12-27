import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";
import { Loader2, CreditCard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsBilling() {
  const { subscription, usage, loading, error, planName } = useSubscription();

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

  // Get property limit from subscription or default
  const propertyLimit =
    subscription?.tier?.entitlements &&
    typeof subscription.tier.entitlements === "object" &&
    "max_properties" in subscription.tier.entitlements
      ? (subscription.tier.entitlements as { max_properties?: number })
          .max_properties ?? 999
      : 999; // Default to high number for free tier

  const propertiesUsed = usage?.property_count ?? 0;
  const usagePercentage = Math.min((propertiesUsed / propertyLimit) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <Card className="shadow-e1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Current Plan</CardTitle>
          </div>
          <CardDescription>
            Your active subscription and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Plan</span>
              <span className="text-lg font-bold text-primary">{planName}</span>
            </div>
            {subscription?.status && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Status</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    subscription.status === "active"
                      ? "text-green-600"
                      : subscription.status === "canceled"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {subscription.status.charAt(0).toUpperCase() +
                    subscription.status.slice(1)}
                </span>
              </div>
            )}
            {subscription?.current_period_end && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Renews On
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Bar */}
      <Card className="shadow-e1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Usage</CardTitle>
          </div>
          <CardDescription>
            Track your organization's resource usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Properties Used
              </span>
              <span className="text-muted-foreground">
                {propertiesUsed} / {propertyLimit === 999 ? "∞" : propertyLimit}
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
            {usagePercentage >= 90 && (
              <p className="text-xs text-destructive">
                You're approaching your limit. Consider upgrading your plan.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

