import { useNavigate } from "react-router-dom";
import { propertySubPath } from "@/lib/propertyRoutes";
import { Building2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompliancePropertyRowProps {
  propertyId: string;
  propertyName: string;
  expiredCount: number;
  expiringCount: number;
  validCount: number;
  totalCount: number;
  hazardCount?: number;
  assetLinksCount?: number;
  spaceLinksCount?: number;
}

export function CompliancePropertyRow({
  propertyId,
  propertyName,
  expiredCount,
  expiringCount,
  validCount,
  totalCount,
  hazardCount = 0,
  assetLinksCount,
  spaceLinksCount,
}: CompliancePropertyRowProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(propertySubPath(propertyId, "compliance"))}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-lg",
        "bg-card shadow-e1 border border-border/50",
        "hover:shadow-e2 transition-all duration-200 text-left"
      )}
    >
      <div className="p-2 rounded-lg bg-surface-gradient shadow-engraved shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{propertyName || "Unnamed Property"}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {expiredCount > 0 && (
            <span className="text-destructive font-medium">{expiredCount} expired</span>
          )}
          {expiringCount > 0 && (
            <span className="text-amber-600 font-medium">{expiringCount} expiring</span>
          )}
          {validCount > 0 && (
            <span>{validCount} valid</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-sm text-muted-foreground">
        {hazardCount != null && hazardCount > 0 && (
          <span className="text-amber-600" title="With hazards">{hazardCount} hazards</span>
        )}
        {assetLinksCount != null && assetLinksCount > 0 && (
          <span>{assetLinksCount} assets</span>
        )}
        {spaceLinksCount != null && spaceLinksCount > 0 && (
          <span>{spaceLinksCount} spaces</span>
        )}
        <span>{totalCount} total</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
