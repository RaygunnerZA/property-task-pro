import { useState } from "react";
import { format, parseISO, isPast, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Shield } from "lucide-react";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { useMarkComplianceComplete } from "@/hooks/useMarkComplianceComplete";

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
    /** rule_id from compliance_documents (Sprint 1+) */
    rule_id?: string | null;
  };
  onClick?: () => void;
  /** When provided, enables quick-action row (complete, create task, view rule) */
  propertyId?: string;
  /** Callback to navigate to Rules tab when "View rule" is clicked */
  onViewRule?: () => void;
}

/**
 * Compliance Card Component
 * Task-like card styling for compliance items
 * Shows: Certificate name → Expiry date → Status (Red/Green/Amber)
 */
export function ComplianceCard({
  compliance,
  onClick,
  propertyId,
  onViewRule,
}: ComplianceCardProps) {
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const markComplete = useMarkComplianceComplete();
  const name = compliance.certificate_name || compliance.document_name || compliance.name || (compliance as any).title || "Unknown";
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

        {/* Quick-action row — visible on hover (desktop) or always (mobile) */}
        {propertyId && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 pt-2 border-t border-border/30",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
              "@[0px]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={markComplete.isPending}
              onClick={(e) => {
                e.stopPropagation();
                markComplete.mutate({
                  complianceDocId: compliance.id,
                  propertyId,
                  ruleId: compliance.rule_id ?? undefined,
                });
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-success transition-colors px-2 py-1 rounded-[4px] hover:bg-success/10"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCreateTaskOpen(true);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-[4px] hover:bg-primary/10"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Create task</span>
            </button>
            {compliance.rule_id && onViewRule && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewRule();
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-[4px] hover:bg-muted/50"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>View rule</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create task modal — triggered by quick action */}
      {propertyId && (
        <CreateTaskModal
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          defaultPropertyId={propertyId}
          prefill={{
            title: `Compliance: ${name}`,
            propertyId,
            is_compliance: true,
          } as any}
        />
      )}
    </div>
  );
}

