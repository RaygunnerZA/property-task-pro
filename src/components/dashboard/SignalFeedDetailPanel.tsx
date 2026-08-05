import { useState } from "react";
import { Inbox, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { IntakeActionButton, IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  columnShellClass,
  slideOverBackdropClass,
  slideOverCenterHostClass,
  slideOverPanelClass,
} from "@/lib/layoutClasses";
import type { SignalKind } from "@/types/workbenchSignals";
import { ISSUES_STREAM_META_CLASSNAME } from "@/components/dashboard/OperationalStreamCard";
import type { IntakeMode } from "@/types/intake";
import { usePromoteExternalEmailSignal } from "@/hooks/usePromoteExternalEmailSignal";
import { useSignalActions } from "@/hooks/useSignalActions";

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
  recommendation?: Record<string, unknown>;
  signalSubtype?: string;
  signalId?: string;
  signalPayload?: Record<string, unknown>;
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
  /** Opens Add to Filla after promoting an external email signal. */
  onOpenAddToFilla?: () => void;
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
  onOpenAddToFilla,
}: SignalFeedDetailPanelProps) {
  const metaLine = snapshot.context?.trim();
  const isExternalEmail = snapshot.signalSubtype === "ingestion.external_email";
  const promote = usePromoteExternalEmailSignal();
  const { dismiss } = useSignalActions();
  const [actionPending, setActionPending] = useState<"promote" | "dismiss" | null>(null);

  const handlePromote = async () => {
    if (!snapshot.signalId || actionPending) return;
    setActionPending("promote");
    try {
      await promote.mutateAsync(snapshot.signalId);
      onOpenAddToFilla?.();
      onClose();
    } catch {
      // toast handled by hook
    } finally {
      setActionPending(null);
    }
  };

  const handleDismiss = async () => {
    if (!snapshot.signalId || actionPending) return;
    setActionPending("dismiss");
    try {
      await dismiss.mutateAsync(snapshot.signalId);
      onClose();
    } catch {
      // toast handled by hook
    } finally {
      setActionPending(null);
    }
  };

  const panelInner = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-4 py-3 shadow-paper-edge">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-primary">
            {GROUP_LABEL[snapshot.group]}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-ink">{snapshot.title}</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 shadow-e1 text-foreground"
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
            <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
              Why this is here
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{snapshot.whyHere.trim()}</p>
          </div>
        ) : null}
        {snapshot.description?.trim() ? (
          <div>
            <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
              Details
            </p>
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
        {isExternalEmail && snapshot.signalPayload ? (
          <div className="space-y-3 rounded-xl bg-muted/25 p-3 text-sm shadow-e1">
            {snapshot.signalPayload.from ? (
              <div>
                <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
                  Sender
                </p>
                <p className="mt-0.5 text-foreground">{String(snapshot.signalPayload.from)}</p>
              </div>
            ) : null}
            {snapshot.signalPayload.subject ? (
              <div>
                <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
                  Subject
                </p>
                <p className="mt-0.5 text-foreground">{String(snapshot.signalPayload.subject)}</p>
              </div>
            ) : null}
            {Array.isArray(snapshot.signalPayload.attachment_paths) &&
            snapshot.signalPayload.attachment_paths.length > 0 ? (
              <div>
                <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
                  Attachments
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-foreground">
                  {(snapshot.signalPayload.attachment_paths as string[]).map((path) => (
                    <li key={path} className="truncate">
                      {path.split("/").pop()}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {snapshot.recommendation ? (
          <div className="rounded-xl bg-muted/25 p-3 text-sm shadow-e1">
            <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
              Recommended action
            </p>
            <p className="mt-1 font-medium text-foreground">
              {String(snapshot.recommendation.title ?? snapshot.recommendation.action ?? "Review")}
            </p>
            {snapshot.recommendation.body ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {String(snapshot.recommendation.body)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {isExternalEmail && snapshot.signalId ? (
        <div className="flex shrink-0 flex-col gap-2 px-4 pb-4 pt-1">
          <IntakeActionButton
            mode="add_record"
            variant="panel"
            className="w-full"
            disabled={actionPending !== null}
            onClick={() => void handlePromote()}
            showIcon={false}
          >
            {actionPending === "promote" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Converting…
              </>
            ) : (
              <>
                <Inbox className="h-4 w-4" aria-hidden />
                Convert to review
              </>
            )}
          </IntakeActionButton>
          <button
            type="button"
            disabled={actionPending !== null}
            onClick={() => void handleDismiss()}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-card text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          >
            {actionPending === "dismiss" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Dismissing…
              </>
            ) : (
              "Dismiss"
            )}
          </button>
        </div>
      ) : onOpenIntake ? (
        <div className="flex shrink-0 flex-col gap-1.5 px-4 pb-4 pt-1">
          <IntakeActionButtonPair
            variant="panel"
            className="w-full gap-2"
            onAddRecord={() => onOpenIntake("add_record")}
            onReportIssue={() => onOpenIntake("report_issue")}
          />
        </div>
      ) : null}
    </div>
  );

  if (variant === "column") {
    return <div className={cn(columnShellClass, "overflow-hidden bg-card")}>{panelInner}</div>;
  }

  return createPortal(
    <>
      <div className={slideOverBackdropClass} onClick={onClose} aria-hidden="true" />
      <div className={slideOverCenterHostClass}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={snapshot.title}
          className={slideOverPanelClass}
        >
          {panelInner}
        </div>
      </div>
    </>,
    document.body
  );
}
