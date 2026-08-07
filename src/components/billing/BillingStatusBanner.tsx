import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isInGrace,
  isExpansionLocked,
  needsPaymentRecovery,
  type OrgBillingStatus,
} from "@/lib/billing/billingState";
import { cn } from "@/lib/utils";

type Props = {
  billing: OrgBillingStatus;
  onManageBilling: () => void;
  busy?: boolean;
  className?: string;
};

export function BillingStatusBanner({
  billing,
  onManageBilling,
  busy,
  className,
}: Props) {
  if (!needsPaymentRecovery(billing)) return null;

  const grace = isInGrace(billing);
  const locked = isExpansionLocked(billing);
  const graceDate = billing.grace_ends_at
    ? new Date(billing.grace_ends_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3",
        locked ? "bg-destructive/10" : "bg-warning/15",
        className
      )}
    >
      <div className="flex gap-3 flex-1 min-w-0">
        {grace ? (
          <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {grace
              ? "Payment issue — grace period active"
              : locked
                ? "Expansion paused — update payment to continue growing"
                : "Billing needs attention"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {grace
              ? `Existing work continues${graceDate ? ` until ${graceDate}` : ""}. After grace, new properties and seats pause.`
              : "You can still complete assigned work and access existing data. Restore payment to add properties or seats."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={locked ? "destructive" : "default"}
        onClick={onManageBilling}
        disabled={busy}
        className="shrink-0"
      >
        <CreditCard className="h-4 w-4 mr-1.5" />
        Manage billing
      </Button>
    </div>
  );
}
