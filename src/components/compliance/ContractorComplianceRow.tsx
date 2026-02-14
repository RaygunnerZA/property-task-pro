import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractorComplianceRowProps {
  contractorName: string;
  linkedCount: number;
  expiredCount: number;
  expiringCount: number;
  validCount: number;
  upcoming30: number;
  upcoming90: number;
  avgDaysOverdue?: number;
}

export function ContractorComplianceRow({
  contractorName,
  linkedCount,
  expiredCount,
  expiringCount,
  validCount,
  upcoming30,
  upcoming90,
  avgDaysOverdue,
}: ContractorComplianceRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg",
        "bg-card shadow-e1 border border-border/50"
      )}
    >
      <div className="p-2 rounded-lg bg-surface-gradient shadow-engraved shrink-0">
        <User className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{contractorName}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          {expiredCount > 0 && (
            <span className="text-destructive font-medium">{expiredCount} expired</span>
          )}
          {expiringCount > 0 && (
            <span className="text-amber-600 font-medium">{expiringCount} expiring</span>
          )}
          {validCount > 0 && <span>{validCount} valid</span>}
          {avgDaysOverdue != null && avgDaysOverdue > 0 && (
            <span className="text-destructive font-medium" title="Average days overdue">Ø {avgDaysOverdue}d overdue</span>
          )}
          <span>{linkedCount} linked</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-muted-foreground">Upcoming</div>
        <div className="flex gap-2 mt-1">
          <span className="text-xs font-medium">30d: {upcoming30}</span>
          <span className="text-xs font-medium">90d: {upcoming90}</span>
        </div>
      </div>
    </div>
  );
}
