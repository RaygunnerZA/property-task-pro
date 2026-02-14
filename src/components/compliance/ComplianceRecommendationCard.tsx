import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HazardBadge } from "./HazardBadge";
import type { ComplianceRecommendation } from "@/hooks/useComplianceRecommendations";

interface ComplianceRecommendationCardProps {
  recommendation: ComplianceRecommendation;
  documentTitle?: string | null;
  propertyName?: string | null;
  expiryDate?: string | null;
  nextDueDate?: string | null;
  spaceCount?: number;
  assetCount?: number;
  onClick: () => void;
}

function getRiskConfig(risk: string) {
  switch (risk) {
    case "critical":
      return { color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle };
    case "high":
      return { color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle };
    case "medium":
      return { color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400", icon: Zap };
    default:
      return { color: "bg-muted/50 text-muted-foreground border-border/50", icon: Shield };
  }
}

export function ComplianceRecommendationCard({
  recommendation,
  documentTitle,
  propertyName,
  expiryDate,
  nextDueDate,
  spaceCount = 0,
  assetCount = 0,
  onClick,
}: ComplianceRecommendationCardProps) {
  const riskConfig = getRiskConfig(recommendation.risk_level);
  const RiskIcon = riskConfig.icon;

  const dueDate = nextDueDate || expiryDate;
  const daysText = dueDate
    ? (() => {
        const days = differenceInCalendarDays(new Date(dueDate), new Date());
        if (days < 0) return `Expired ${Math.abs(days)} days ago`;
        if (days === 0) return "Due today";
        if (days <= 30) return `Expires in ${days} days`;
        return `Expires in ${days} days`;
      })()
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg p-4",
        "bg-card shadow-e1 border border-border/50",
        "hover:shadow-e2 transition-all duration-200"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", riskConfig.color)}>
          <RiskIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">
            {documentTitle || recommendation.recommended_action || "Compliance item"}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className={cn("text-xs font-medium", riskConfig.color)}>
              {recommendation.risk_level}
            </Badge>
            {daysText && (
              <span className="text-xs text-muted-foreground">{daysText}</span>
            )}
          </div>
          {(propertyName || spaceCount > 0 || assetCount > 0) && (
            <div className="text-xs text-muted-foreground mt-1">
              {propertyName}
              {spaceCount > 0 && ` • ${spaceCount} space${spaceCount !== 1 ? "s" : ""}`}
              {assetCount > 0 && ` • ${assetCount} asset${assetCount !== 1 ? "s" : ""}`}
            </div>
          )}
          {recommendation.hazards.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recommendation.hazards.slice(0, 3).map((h) => (
                <HazardBadge key={h} hazard={h} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <span className="text-sm font-medium text-primary">Review Recommendation →</span>
      </div>
    </button>
  );
}
