import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";
import type { ComplianceRecord } from "./complianceRecordModel";

export function RecordsContextSummary({
  complianceRecords,
  documentTotal,
  docUnlinked,
  className,
}: {
  complianceRecords: ComplianceRecord[];
  documentTotal?: number;
  docUnlinked?: number;
  className?: string;
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
      <PanelSectionTitle as="h3" className="ml-0.5">
        Records at a glance
      </PanelSectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {cells.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center text-center rounded-xl bg-transparent py-2.5 px-0.5",
              "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
            )}
          >
            <p
              className="inline-block bg-paper bg-paper-texture bg-clip-text leading-none text-shadow-neu tabular-nums text-[26px] font-medium"
              style={{ color: metric.color, fontFamily: '"Inter Tight"' }}
            >
              {metric.value}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground leading-tight">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
      {documentTotal != null && (
        <p className="text-[11px] text-muted-foreground px-0.5">
          <span className="font-medium text-foreground">{documentTotal}</span> stored documents
          {docUnlinked != null && docUnlinked > 0 ? (
            <>
              {" "}
              · <span className="text-amber-700 font-medium">{docUnlinked}</span> unlinked
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
