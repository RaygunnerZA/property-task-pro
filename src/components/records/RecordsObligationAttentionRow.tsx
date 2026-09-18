import { AlertTriangle, FileText, ShieldCheck, Waves } from "lucide-react";
import { SemanticChip } from "@/components/chips/semantic";
import {
  formatDueText,
  getComplianceStatusText,
  type ComplianceRecord,
} from "@/components/records/complianceRecordModel";
import { cn } from "@/lib/utils";

type RecordsObligationAttentionRowProps = {
  record: ComplianceRecord;
  onOpen?: () => void;
  className?: string;
};

function statusIcon(status: ComplianceRecord["status"]) {
  if (status === "overdue") {
    return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />;
  }
  if (status === "expiring") {
    return <Waves className="h-4 w-4 text-warning-foreground" aria-hidden />;
  }
  if (status === "missing") {
    return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />;
  }
  return <ShieldCheck className="h-4 w-4 text-success-foreground" aria-hidden />;
}

/**
 * Non-draggable Attention row for a compliance obligation
 * (@Docs/04_UI_System.md — obligations appear in Attention, not Types filing).
 */
export function RecordsObligationAttentionRow({
  record,
  onOpen,
  className,
}: RecordsObligationAttentionRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full min-w-0 items-start gap-3 rounded-[10px] bg-card/80 px-3 py-2.5 text-left shadow-e1",
        "transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-card shadow-e1">
        {statusIcon(record.status)}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
          {record.title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <SemanticChip
            epistemic="fact"
            size="compact"
            label="Obligation"
            className="!h-5 !px-1.5 !text-[10px] opacity-75"
            color="hsl(var(--muted))"
          />
          <SemanticChip
            epistemic="fact"
            size="compact"
            label={record.complianceType}
            className="!h-5 !px-1.5 !text-[10px] opacity-75"
            color="hsl(var(--muted))"
          />
          <span className="text-2xs text-muted-foreground">
            {record.propertyName}
            {" · "}
            {getComplianceStatusText(record)}
            {" · "}
            {formatDueText(record.nextDueDate || record.expiryDate)}
          </span>
        </span>
      </span>
    </button>
  );
}
