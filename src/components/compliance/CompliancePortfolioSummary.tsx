import { useMemo } from "react";
import { Shield, AlertTriangle, Clock, CheckCircle2, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompliancePortfolioSummaryProps {
  items: Array<{ expiry_state?: string; property_id?: string | null }>;
}

export function CompliancePortfolioSummary({ items }: CompliancePortfolioSummaryProps) {
  const counts = useMemo(() => {
    const expired = items.filter((i) => i.expiry_state === "expired");
    const expiring = items.filter((i) => i.expiry_state === "expiring");
    const valid = items.filter((i) => i.expiry_state === "valid");
    const unassigned = items.filter((i) => !i.property_id);
    return { expired: expired.length, expiring: expiring.length, valid: valid.length, unassigned: unassigned.length };
  }, [items]);

  const cards = [
    { label: "Expired", value: counts.expired, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Expiring soon", value: counts.expiring, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Valid", value: counts.valid, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Unassigned", value: counts.unassigned, icon: Building2, color: "text-muted-foreground", bg: "bg-muted/50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={cn(
              "rounded-lg p-4 shadow-e1 flex items-center gap-3",
              "bg-card border border-border/50"
            )}
          >
            <div className={cn("p-2 rounded-lg", card.bg, card.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
