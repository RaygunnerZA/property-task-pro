import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_CATALOG, type PlanTierId } from "@/lib/billing/planCatalog";
import { cn } from "@/lib/utils";

type Props = {
  currentPlanId: string | null;
  onSelectPlan: (tierId: PlanTierId) => void;
  onManageExisting: () => void;
  hasStripeSubscription: boolean;
  busy?: boolean;
  className?: string;
};

export function PlanComparison({
  currentPlanId,
  onSelectPlan,
  onManageExisting,
  hasStripeSubscription,
  busy,
  className,
}: Props) {
  const current = currentPlanId ?? "home";

  return (
    <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>
      {PLAN_CATALOG.map((plan) => {
        const isCurrent = plan.id === current || (current === "home" && plan.id === "home" && !currentPlanId);
        const canCheckout = plan.checkoutEligible;

        return (
          <Card
            key={plan.id}
            className={cn(
              "shadow-e1 flex flex-col",
              isCurrent && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{plan.name}</span>
                {isCurrent && (
                  <span className="text-xs font-medium text-primary">Current</span>
                )}
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                “{plan.buyerStatement}”
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-3">
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>{plan.properties}</p>
                <p>{plan.coordinating}</p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button type="button" variant="secondary" disabled className="w-full">
                  Current plan
                </Button>
              ) : canCheckout ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    if (hasStripeSubscription) onManageExisting();
                    else onSelectPlan(plan.id);
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasStripeSubscription ? (
                    "Change in billing portal"
                  ) : (
                    `Choose ${plan.name}`
                  )}
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled className="w-full">
                  Free default
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
