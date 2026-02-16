import { useNavigate } from "react-router-dom";
import { Shield, ChevronRight } from "lucide-react";
import { HazardBadge } from "./HazardBadge";
import { cn } from "@/lib/utils";

interface RelatedComplianceItem {
  id: string;
  title?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  expiry_date?: string | null;
  next_due_date?: string | null;
  expiry_state?: string;
  hazards?: string[] | null;
  linked_asset_ids?: string[] | null;
}

interface RelatedComplianceSectionProps {
  items: RelatedComplianceItem[];
  imageHazards?: string[];
  isLoading?: boolean;
  hideHeader?: boolean;
}

function getExpiryColor(expiryState?: string) {
  if (expiryState === "expired") return "text-destructive";
  if (expiryState === "expiring") return "text-amber-600";
  return "text-muted-foreground";
}

export function RelatedComplianceSection({
  items,
  imageHazards = [],
  isLoading,
  hideHeader = false,
}: RelatedComplianceSectionProps) {
  const navigate = useNavigate();

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">Related Compliance Items</h3>
        </div>
      )}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : items.length === 0 && imageHazards.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No compliance items linked to this property. Add compliance documents to see them here.
        </div>
      ) : (
        <div className="space-y-2">
          {imageHazards.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                Hazards detected in images
              </div>
              <div className="flex flex-wrap gap-1">
                {imageHazards.map((h) => (
                  <HazardBadge key={h} hazard={h} size="sm" />
                ))}
              </div>
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/properties/${item.property_id || ""}/compliance`)}
              className={cn(
                "w-full text-left p-2 rounded-lg",
                "bg-card shadow-e1 border border-border/50",
                "hover:shadow-e2 transition-all flex items-center gap-2"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {item.title || "Untitled"}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {Array.isArray(item.hazards) &&
                    item.hazards.slice(0, 3).map((h) => (
                      <HazardBadge key={h} hazard={h} size="sm" />
                    ))}
                  <span className={cn("text-[10px] font-medium", getExpiryColor(item.expiry_state))}>
                    {item.expiry_state === "expired"
                      ? "Expired"
                      : item.expiry_state === "expiring"
                      ? "Expiring"
                      : "Valid"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
