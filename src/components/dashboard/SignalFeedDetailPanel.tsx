import { X } from "lucide-react";
import { IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SignalKind } from "@/types/workbenchSignals";
import { ISSUES_STREAM_META_CLASSNAME } from "@/components/dashboard/OperationalStreamCard";
import type { IntakeMode } from "@/types/intake";

/** Serializable snapshot for workbench signal / attention rows (matches TaskPanel AttentionItem fields used in UI). */
export type SignalFeedDetailSnapshot = {
  id: string;
  group: "urgent" | "review" | "recent";
  title: string;
  context: string;
  description?: string;
  whyHere?: string;
  footChipLabel?: string;
  signalKind?: SignalKind;
  messageId?: string;
  complianceSeed?: {
    title: string;
    propertyName: string;
    propertyId?: string | null;
    complianceType: string;
  };
};

/** Card click on Issues stream → workbench third column / modal (not a DB entity). */
export type WorkbenchAttentionSelectPayload =
  | { kind: "message"; messageId: string }
  | { kind: "signal"; snapshot: SignalFeedDetailSnapshot };

interface SignalFeedDetailPanelProps {
  snapshot: SignalFeedDetailSnapshot;
  onClose: () => void;
  variant?: "modal" | "column";
  onOpenIntake?: (mode: IntakeMode) => void;
}

const GROUP_LABEL: Record<SignalFeedDetailSnapshot["group"], string> = {
  urgent: "Urgent signal",
  review: "Needs review",
  recent: "Recent signal",
};

/**
 * Read-only detail for Issues stream rows that are not tasks or inbox messages
 * (fixtures, compliance drafts, system signals). Tasks and messages use their own panels.
 */
export function SignalFeedDetailPanel({
  snapshot,
  onClose,
  variant = "modal",
  onOpenIntake,
}: SignalFeedDetailPanelProps) {
  const metaLine = snapshot.context?.trim();

  const panelInner = (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-4 py-3 shadow-paper-edge">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {GROUP_LABEL[snapshot.group]}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-ink">{snapshot.title}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {metaLine ? <p className={ISSUES_STREAM_META_CLASSNAME}>{metaLine}</p> : null}
        {snapshot.whyHere?.trim() ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Why this is here</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{snapshot.whyHere.trim()}</p>
          </div>
        ) : null}
        {snapshot.description?.trim() ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{snapshot.description.trim()}</p>
          </div>
        ) : null}
        {snapshot.complianceSeed ? (
          <div className="rounded-xl bg-muted/25 p-3 text-sm shadow-e1">
            <p className="font-medium text-foreground">{snapshot.complianceSeed.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.complianceSeed.propertyName} · {snapshot.complianceSeed.complianceType}
            </p>
          </div>
        ) : null}
        {onOpenIntake ? (
          <IntakeActionButtonPair
            variant="micro"
            className="pt-1"
            onAddRecord={() => onOpenIntake("add_record")}
            onReportIssue={() => onOpenIntake("report_issue")}
          />
        ) : null}
      </div>
    </>
  );

  if (variant === "column") {
    return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">{panelInner}</div>;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-card shadow-2xl md:w-[min(100%,480px)]",
          "transform transition-transform duration-300 ease-out translate-x-0"
        )}
      >
        {panelInner}
      </div>
    </>
  );
}
