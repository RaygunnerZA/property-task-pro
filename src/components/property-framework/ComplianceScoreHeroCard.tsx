/**
 * ComplianceScoreHeroCard - Framework V2
 * Height: 180px max. Gradient band: green >90%, amber 70-90%, red <70%
 */
import { cn } from "@/lib/utils";

interface ComplianceScoreHeroCardProps {
  scorePercent: number;
  criticalCount: number;
  dueSoonCount: number;
  onViewCritical?: () => void;
  className?: string;
}

function getBandClass(score: number): string {
  if (score >= 90) return "bg-success/25";
  if (score >= 70) return "bg-warning/25";
  return "bg-destructive/25";
}

export function ComplianceScoreHeroCard({
  scorePercent,
  criticalCount,
  dueSoonCount,
  onViewCritical,
  className,
}: ComplianceScoreHeroCardProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] overflow-hidden shadow-e1 max-h-[180px] flex flex-col",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2 hover:-translate-y-0.5",
        className
      )}
    >
      <div className={cn("h-9 flex-shrink-0", getBandClass(scorePercent))} />
      <div className="flex-1 p-4 bg-card flex flex-col gap-2 min-h-0">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{scorePercent}%</span>
          <span className="text-sm text-muted-foreground">Compliance</span>
        </div>
        <div className="flex gap-4 text-sm">
          <span className={criticalCount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {criticalCount} critical
          </span>
          <span className={dueSoonCount > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
            {dueSoonCount} due soon
          </span>
        </div>
        {onViewCritical && criticalCount > 0 && (
          <button
            type="button"
            onClick={onViewCritical}
            className="text-sm text-primary font-medium hover:underline self-start mt-1"
          >
            View critical
          </button>
        )}
      </div>
    </div>
  );
}
