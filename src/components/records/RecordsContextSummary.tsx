import { cn } from "@/lib/utils";
import { WorkspaceHealthGrid } from "@/components/property-workspace/WorkspaceHealthGrid";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { ComplianceRecord } from "./complianceRecordModel";

export function RecordsContextSummary({
  complianceRecords,
  documentTotal,
  docUnlinked,
  className,
  /** Kept for call-site compatibility; strip uses the shared Tasks density. */
  dense: _dense = false,
  recordsView,
  onRecordsViewChange,
}: {
  complianceRecords: ComplianceRecord[];
  documentTotal?: number;
  docUnlinked?: number;
  className?: string;
  dense?: boolean;
  recordsView?: RecordsView;
  onRecordsViewChange?: (next: RecordsView) => void;
}) {
  const expiring = complianceRecords.filter((r) => r.status === "expiring").length;
  const overdue = complianceRecords.filter((r) => r.status === "overdue").length;
  const missing = complianceRecords.filter((r) => r.status === "missing").length;

  const activate = (view: Extract<RecordsView, "expiring" | "overdue" | "missing">) => {
    if (!onRecordsViewChange) return;
    onRecordsViewChange(recordsView === view ? "all" : view);
  };

  const stats = [
    {
      line1: "expiring",
      line2: "soon",
      value: expiring,
      color: "rgba(255, 184, 77, 1)",
      secondaryCount: overdue,
      secondaryLabel: "LATE",
      secondaryTone: (overdue > 0 ? "urgent" : "neutral") as const,
      onClick: onRecordsViewChange ? () => activate("expiring") : undefined,
      selected: recordsView === "expiring",
    },
    {
      line1: "overdue",
      line2: "items",
      value: overdue,
      color: "rgba(235, 104, 52, 1)",
      secondaryCount: missing,
      secondaryLabel: "GAP",
      secondaryTone: (missing > 0 ? "warning" : "neutral") as const,
      onClick: onRecordsViewChange ? () => activate("overdue") : undefined,
      selected: recordsView === "overdue",
    },
    {
      line1: "missing",
      line2: "files",
      value: missing,
      color: "rgba(100, 116, 139, 1)",
      secondaryCount: expiring,
      secondaryLabel: "WATCH",
      secondaryTone: (expiring > 0 ? "warning" : "neutral") as const,
      onClick: onRecordsViewChange ? () => activate("missing") : undefined,
      selected: recordsView === "missing",
    },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <WorkspaceHealthGrid stats={stats} ariaLabel="Property health" dense={false} />
      {documentTotal != null && (
        <p className="px-0.5 text-caption text-muted-foreground">
          <span className="font-medium text-foreground">{documentTotal}</span> stored documents
          {docUnlinked != null && docUnlinked > 0 ? (
            <>
              {" "}
              · <span className="font-medium text-warning-foreground">{docUnlinked}</span> unlinked
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
