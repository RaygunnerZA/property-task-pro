import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface DocumentCardProps {
  document: {
    id: string;
    name?: string;
    document_name?: string;
    document_type?: string;
    status?: string;
    valid_until?: string | null;
    expiry_date?: string | null;
    created_at?: string;
  };
  onClick?: () => void;
}

/**
 * Document Card Component
 * Task-like card styling for documents
 * Shows: Document name → Status → Date
 * Examples: "Lease → Valid until X", "Insurance → Missing"
 */
export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const rawName = document.document_name || document.name || document.document_type || "Unknown Document";
  // Remove file extension
  const name = rawName.replace(/\.[^/.]+$/, "");
  const status = document.status || "missing";
  const validUntil = document.valid_until || document.expiry_date;
  const createdDate = document.created_at;

  // Determine status color and icon
  const getStatusConfig = () => {
    if (status === "missing" || status === "absent") {
      return {
        color: "text-muted-foreground",
        bgColor: "bg-muted/30",
        borderColor: "border-border/30",
        icon: AlertCircle,
        label: "Missing",
      };
    } else if (status === "valid" || status === "active") {
      return {
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/30",
        icon: CheckCircle2,
        label: "Valid",
      };
    } else {
      return {
        color: "text-muted-foreground",
        bgColor: "bg-muted/30",
        borderColor: "border-border/30",
        icon: FileText,
        label: status,
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Format dates
  const validUntilFormatted = validUntil
    ? format(parseISO(validUntil), "MMM dd, yyyy")
    : null;
  const createdDateFormatted = createdDate
    ? format(parseISO(createdDate), "MMM dd, yyyy")
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
          status === "valid" || status === "active" ? "bg-success" : "bg-muted"
        )}
      />

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex flex-col justify-center min-w-0">
        {/* Document Name */}
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

        {/* Date Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {validUntilFormatted && (
            <span>Valid until {validUntilFormatted}</span>
          )}
          {!validUntilFormatted && createdDateFormatted && (
            <span>Uploaded {createdDateFormatted}</span>
          )}
        </div>

        {/* Dummy text (4 instances) */}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground">Dummy text 1</span>
          <span className="text-[10px] text-muted-foreground">Dummy text 2</span>
          <span className="text-[10px] text-muted-foreground">Dummy text 3</span>
          <span className="text-[10px] text-muted-foreground">Dummy text 4</span>
        </div>
      </div>
    </div>
  );
}

