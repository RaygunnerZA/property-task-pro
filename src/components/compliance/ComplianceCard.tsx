import { format, parseISO, isPast, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, Shield } from "lucide-react";

interface ComplianceCardProps {
  compliance: {
    id: string;
    name?: string;
    certificate_name?: string;
    document_name?: string;
    expiry_date?: string | null;
    expiry_status?: string;
    days_until_expiry?: number | null;
    status?: string;
  };
  onClick?: () => void;
}

/**
 * Compliance Card Component
 * Task-like card styling for compliance items
 * Shows: Certificate name → Expiry date → Status (Red/Green/Amber)
 */
export function ComplianceCard({ compliance, onClick }: ComplianceCardProps) {
  const name = compliance.certificate_name || compliance.document_name || compliance.name || "Unknown";
  const expiryStatus = compliance.expiry_status || "none";
  const daysUntilExpiry = compliance.days_until_expiry;

  // Determine status color and icon
  const getStatusConfig = () => {
    if (expiryStatus === "expired") {
      return {
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
        icon: AlertTriangle,
        label: "Expired",
      };
    } else if (expiryStatus === "expiring") {
      return {
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        icon: Clock,
        label: "Expiring Soon",
      };
    } else {
      return {
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        icon: CheckCircle2,
        label: "Valid",
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Format expiry date
  const expiryDateFormatted = compliance.expiry_date
    ? format(parseISO(compliance.expiry_date), "MMM dd, yyyy")
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[8px] bg-card shadow-e1",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
        "overflow-hidden flex flex-row min-h-[80px] relative group",
        "border border-border/50"
      )}
    >
      {/* Status Indicator - Left border */}
      <div
        className={cn(
          "w-1 flex-shrink-0",
          expiryStatus === "expired" && "bg-destructive",
          expiryStatus === "expiring" && "bg-amber-500",
          expiryStatus !== "expired" && expiryStatus !== "expiring" && "bg-success"
        )}
      />

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex flex-col justify-center min-w-0">
        {/* Certificate/Document Name */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-foreground text-sm line-clamp-2 flex-1">
            {name}
          </h3>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-[5px] text-xs font-medium flex-shrink-0",
              statusConfig.bgColor,
              statusConfig.color,
              statusConfig.borderColor,
              "border"
            )}
          >
            <StatusIcon className="h-3 w-3" />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Expiry Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {expiryDateFormatted && (
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              <span>Expires {expiryDateFormatted}</span>
            </span>
          )}
          {daysUntilExpiry !== null && daysUntilExpiry !== undefined && (
            <span>
              {daysUntilExpiry < 0
                ? `${Math.abs(daysUntilExpiry)} days ago`
                : daysUntilExpiry === 0
                ? "Today"
                : `${daysUntilExpiry} days`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

