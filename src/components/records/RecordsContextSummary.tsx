import { cn } from "@/lib/utils";
import type { ComplianceRecord } from "./complianceRecordModel";

export function RecordsContextSummary({
  complianceRecords,
  documentTotal,
  docUnlinked,
  className,
  /** Tighter type/padding for narrow rails. */
  dense = false,
}: {
  complianceRecords: ComplianceRecord[];
  documentTotal?: number;
  docUnlinked?: number;
  className?: string;
  dense?: boolean;
}) {
  const healthy = complianceRecords.filter((r) => r.status === "healthy").length;
  const expiring = complianceRecords.filter((r) => r.status === "expiring").length;
  const overdue = complianceRecords.filter((r) => r.status === "overdue").length;
  const missing = complianceRecords.filter((r) => r.status === "missing").length;

  const cells = [
    { label: "Healthy", value: healthy, color: "rgba(16, 185, 129, 1)" },
    { label: "Expiring", value: expiring, color: "rgba(255, 184, 77, 1)" },
    { label: "Overdue", value: overdue, color: "rgba(235, 104, 52, 1)" },
    { label: "Missing", value: missing, color: "rgba(100, 116, 139, 1)" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-4 gap-1">
        {cells.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center rounded-xl bg-transparent text-center",
              dense ? "px-0.5 py-1.5" : "px-0.5 py-2",
              "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
            )}
          >
            <p
              className={cn(
                "font-display font-medium leading-none tabular-nums text-shadow-neu-pressed",
                dense ? "text-[18px]" : "text-[22px]"
              )}
              style={{ color: metric.color }}
            >
              {metric.value}
            </p>
            <p className="mt-0.5 max-w-full truncate text-2xs leading-tight text-muted-foreground">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
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
