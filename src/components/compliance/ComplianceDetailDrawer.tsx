import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { HazardBadge } from "./HazardBadge";
import { ComplianceGraphMini } from "./ComplianceGraphMini";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";

interface ComplianceDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compliance: {
    id: string;
    title?: string | null;
    property_id?: string | null;
    property_name?: string | null;
    expiry_date?: string | null;
    next_due_date?: string | null;
    expiry_state?: string;
    document_type?: string | null;
    hazards?: string[] | null;
  } | null;
}

export function ComplianceDetailDrawer({
  open,
  onOpenChange,
  compliance,
}: ComplianceDetailDrawerProps) {
  const navigate = useNavigate();
  const expiryStatus = compliance?.expiry_state || "none";

  const getStatusConfig = () => {
    if (expiryStatus === "expired") {
      return { color: "text-destructive", icon: AlertTriangle, label: "Expired" };
    }
    if (expiryStatus === "expiring") {
      return { color: "text-amber-600", icon: Clock, label: "Expiring Soon" };
    }
    return { color: "text-success", icon: CheckCircle2, label: "Valid" };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const handleViewProperty = () => {
    if (compliance?.property_id) {
      onOpenChange(false);
      navigate(`/properties/${compliance.property_id}/compliance`);
    }
  };

  if (!compliance) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {compliance.title || "Compliance Item"}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", statusConfig.color)}>
            <StatusIcon className="h-4 w-4" />
            <span className="font-medium">{statusConfig.label}</span>
          </div>
          {compliance.property_name && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Property</div>
              <div className="font-medium">{compliance.property_name}</div>
            </div>
          )}
          {compliance.document_type && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Type</div>
              <div>{compliance.document_type}</div>
            </div>
          )}
          {(compliance.next_due_date || compliance.expiry_date) && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Due / Expiry</div>
              <div>
                {format(
                  parseISO(compliance.next_due_date || compliance.expiry_date!),
                  "MMM dd, yyyy"
                )}
              </div>
            </div>
          )}
          {Array.isArray(compliance.hazards) && compliance.hazards.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hazards</div>
              <div className="flex flex-wrap gap-1">
                {compliance.hazards.map((h) => (
                  <HazardBadge key={h} hazard={h} />
                ))}
              </div>
            </div>
          )}
          <ComplianceGraphMini complianceDocumentId={compliance.id} />
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Graph Impact</div>
            <GraphInsightPanel
              start={{ type: "compliance", id: compliance.id }}
              depth={2}
              variant="compact"
            />
          </div>
          {compliance.property_id && (
            <Button variant="outline" className="w-full" onClick={handleViewProperty}>
              View property compliance
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
