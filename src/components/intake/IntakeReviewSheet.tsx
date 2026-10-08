import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ignoreIntakeItem } from "@/services/intake/intakeUpload";
import { useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import { useToast } from "@/hooks/use-toast";
import type { IntakeMode } from "@/types/intake";
import type { IntakeReviewPayload } from "@/components/intake/IntakeInboxPanel";
import type { IntakeItemStatus, IntakeSourceArtifact } from "@/types/intake-item";
import { formatIntakeFileSize } from "@/lib/intakeReviewSummary";
import {
  decideIntake,
  intakeDecisionActionLabel,
  type IntakeDecision,
  type IntakeDecisionAction,
} from "@/lib/intake/intakeDecision";
import {
  inboundEmailOutcomeLabel,
  inboundEmailSenderLabel,
  readInboundEmailProposal,
} from "@/lib/intake/inboundEmailProposal";
import {
  buildIntakeDocumentBriefing,
  intakeOutcomeLabel,
} from "@/lib/intakeDocumentBriefing";
import { useInboxFilePreview } from "@/hooks/useInboxFilePreview";
import { IntakeFileThumb } from "@/components/intake/IntakeFileThumb";
import { IntakeFilePreviewFrame } from "@/components/intake/IntakeFilePreviewFrame";
import { cn } from "@/lib/utils";
import {
  intakeAddRecordDrawerCardClassName,
  intakeReportIssueDrawerCardClassName,
} from "@/lib/intake-action-buttons";

interface IntakeReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: IntakeReviewPayload | null;
  propertyName?: string | null;
  propertyAddress?: string | null;
  onContinue: (mode: IntakeMode) => void;
  onBackToUploads?: () => void;
}

function IntakeDecisionPanel({
  decision,
  confirmedAction,
  showOtherActions,
  filingKnowledge,
  allowKnowledge,
  onConfirm,
  onRun,
  onToggleOther,
}: {
  decision: IntakeDecision;
  confirmedAction: IntakeDecisionAction | null;
  showOtherActions: boolean;
  filingKnowledge: boolean;
  allowKnowledge: boolean;
  onConfirm: (action: IntakeDecisionAction | "something_else") => void;
  onRun: (action: IntakeDecisionAction) => void;
  onToggleOther: () => void;
}) {
  const ready =
    decision.action_confidence === "sufficient" || confirmedAction != null;
  const action = confirmedAction || (decision.recommended_action === "ask" ? null : decision.recommended_action);
  const alternatives = decision.alternative_actions.filter(
    (item) => item !== action && (item !== "keep_knowledge" || allowKnowledge)
  );

  return (
    <div className="space-y-3">
      {!ready && decision.blocking_uncertainty === "still_reading" ? (
        <p className="text-sm text-muted-foreground">{decision.reason}</p>
      ) : null}

      {!ready && decision.clarifying_question ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{decision.clarifying_question}</p>
          <div className="flex flex-col gap-2">
            {decision.clarifying_options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onConfirm(option.action)}
                className="min-h-11 rounded-lg bg-card px-3 py-2 text-left text-sm font-medium text-foreground shadow-e1"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {ready && action ? (
        <button
          type="button"
          disabled={action === "keep_knowledge" && filingKnowledge}
          onClick={() => onRun(action)}
          className={cn(
            action === "create_task"
              ? intakeReportIssueDrawerCardClassName
              : action === "keep_knowledge"
                ? "w-full rounded-lg border-0 bg-card p-4 text-left text-foreground shadow-e1"
                : intakeAddRecordDrawerCardClassName
          )}
        >
          <div className="flex items-start gap-3">
            {action === "create_task" ? (
              <Plus className="h-5 w-5 shrink-0 mt-0.5" />
            ) : action === "keep_knowledge" ? (
              filingKnowledge ? (
                <Loader2 className="h-5 w-5 shrink-0 mt-0.5 animate-spin" />
              ) : (
                <BookOpen className="h-5 w-5 shrink-0 mt-0.5" />
              )
            ) : (
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <div className="text-left">
              <p className="font-semibold">
                {intakeDecisionActionLabel(action, decision.understanding.label)}
              </p>
              <p className="text-xs font-normal mt-0.5 opacity-90">{decision.reason}</p>
            </div>
          </div>
        </button>
      ) : null}

      {(ready || decision.blocking_uncertainty === "still_reading") && alternatives.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onToggleOther}
            className="text-xs font-medium text-muted-foreground"
          >
            Other actions
          </button>
          {showOtherActions
            ? alternatives.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onRun(item)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
                >
                  {intakeDecisionActionLabel(item, decision.understanding.label)}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-2">
      <dt className="text-xs text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground leading-snug">{value}</dd>
    </div>
  );
}

export function IntakeReviewSheet({
  open,
  onOpenChange,
  payload,
  propertyName,
  propertyAddress,
  onContinue,
  onBackToUploads,
}: IntakeReviewSheetProps) {
  const { toast } = useToast();
  const invalidate = useIntakeItemsInvalidator();
  const [dismissing, setDismissing] = useState(false);
  const [filingKnowledge, setFilingKnowledge] = useState(false);
  const [confirmedAction, setConfirmedAction] = useState<IntakeDecisionAction | null>(null);
  const [showOtherActions, setShowOtherActions] = useState(false);
  const [askedWhatThisIs, setAskedWhatThisIs] = useState(false);
  const [artifact, setArtifact] = useState<IntakeSourceArtifact | null>(payload?.sourceArtifact ?? null);
  const [itemStatus, setItemStatus] = useState<IntakeItemStatus | null>(null);

  useEffect(() => {
    setArtifact(payload?.sourceArtifact ?? null);
    setItemStatus(null);
    setConfirmedAction(null);
    setShowOtherActions(false);
    setAskedWhatThisIs(false);
  }, [payload?.sourceArtifact?.intakeItemId]);

  useEffect(() => {
    if (!open || !payload?.sourceArtifact?.intakeItemId) return;

    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      const { data, error } = await supabase
        .from("intake_items")
        .select("*")
        .eq("id", payload.sourceArtifact.intakeItemId)
        .maybeSingle();
      if (cancelled || error || !data) return;

      setItemStatus(data.status as IntakeItemStatus);
      setArtifact({
        intakeItemId: data.id,
        storagePath: data.storage_path,
        fileName: data.file_name,
        mimeType: data.mime_type || payload.sourceArtifact.mimeType,
        rawText: data.raw_text,
        sourceType: data.source_type,
        aiClassification: data.ai_classification,
        aiExtracted: (data.ai_extracted as Record<string, unknown> | null) ?? null,
        emailProvenance: (data.email_provenance as Record<string, unknown> | null) ?? null,
      });

      if (data.status === "pending" || data.status === "processing") {
        timer = window.setTimeout(() => {
          void load();
        }, 2500);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [open, payload?.sourceArtifact]);

  const preview = useInboxFilePreview({
    storagePath: artifact?.storagePath ?? null,
    mimeType: artifact?.mimeType,
    fileName: artifact?.fileName,
    fileSize: payload?.fileSize,
    enabled: open && Boolean(artifact?.storagePath),
  });
  const proposal = artifact ? readInboundEmailProposal(artifact.aiExtracted) : null;
  const senderLabel = inboundEmailSenderLabel(artifact?.emailProvenance);
  const isMemberEmail =
    (artifact?.emailProvenance as { channel?: string } | null | undefined)?.channel ===
    "member_intake_email";
  const briefing = artifact
    ? buildIntakeDocumentBriefing(artifact, preview.extractedText, {
        propertyName,
        propertyAddress,
      })
    : null;
  const decision: IntakeDecision | null = briefing
    ? decideIntake({
        briefing,
        mimeType: artifact?.mimeType,
        scanStillRunning:
          itemStatus === "pending" ||
          itemStatus === "processing" ||
          (preview.loading && briefing.typeEvidence !== "document"),
        allowKnowledge: isMemberEmail,
        proposal,
      })
    : null;
  const scanStillRunning = itemStatus === "pending" || itemStatus === "processing";
  const fileSizeLabel = formatIntakeFileSize(payload?.fileSize ?? null);
  const isEmailOnly = !artifact?.storagePath && !!artifact?.rawText;
  const displayName = artifact?.fileName || (isEmailOnly ? "Forwarded email" : "Upload");
  const openUrl = preview.openUrl;

  const handleDismiss = async () => {
    if (!artifact) return;
    setDismissing(true);
    try {
      await ignoreIntakeItem(supabase, artifact.intakeItemId);
      void invalidate();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not dismiss",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setDismissing(false);
    }
  };

  const handleKnowledge = async () => {
    if (!artifact) return;
    setFilingKnowledge(true);
    try {
      const { error } = await supabase.rpc("confirm_intake_as_knowledge", {
        p_intake_item_id: artifact.intakeItemId,
      });
      if (error) throw error;
      void invalidate();
      toast({
        title: "Sent to Knowledge review",
        description: "It stays a candidate for this organisation. It is not published.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not file Knowledge",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setFilingKnowledge(false);
    }
  };

  const handleBack = () => {
    onOpenChange(false);
    onBackToUploads?.();
  };

  if (!payload || !artifact || !briefing) return null;

  const outcomeTone =
    briefing.outcome === "unsatisfactory" || briefing.outcome === "expired"
      ? "bg-destructive/15 text-destructive"
      : briefing.outcome === "satisfactory" || briefing.outcome === "valid"
        ? "bg-success/25 text-success-foreground"
        : "bg-muted text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-xl pb-8 max-h-[calc(100dvh-2rem)] overflow-y-auto !inset-x-auto !left-1/2 !right-auto !top-4 !bottom-auto !h-auto !w-full max-w-[min(28rem,calc(100vw-1.5rem))] max-lg:!max-w-[min(28rem,calc(100vw-1.5rem))] !-translate-x-1/2"
      >
        <SheetHeader className="text-left pb-1 space-y-1">
          <div className="flex items-center gap-2">
            {onBackToUploads ? (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground -ml-1"
                aria-label="Back to uploads"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <SheetTitle className="text-base">What we found</SheetTitle>
          </div>
          <SheetDescription>
            {confirmedAction
              ? decision?.reason
              : decision?.clarifying_question ||
                decision?.reason ||
                "Check the read, then confirm the next action."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {senderLabel ? (
            <p className="rounded-[10px] bg-muted/50 px-3 py-2 text-sm font-medium text-foreground shadow-e1">
              {senderLabel}
            </p>
          ) : null}
          {proposal ? (
            <p className="text-sm text-muted-foreground">
              {inboundEmailOutcomeLabel(proposal)}
              {proposal.task_fields?.due_date ? ` · due ${proposal.task_fields.due_date}` : ""}
            </p>
          ) : null}
          <div className="flex items-start gap-3">
            <IntakeFileThumb
              kind={preview.kind}
              thumbnailUrl={preview.thumbnailUrl}
              label={displayName}
              size="md"
              isEmail={isEmailOnly}
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground leading-snug">
                {proposal?.suggested_title || briefing.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayName}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{briefing.fileKindLabel}</span>
                {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open file
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {briefing.typeEvidence === "document" ? (
            <div className="flex flex-wrap gap-1.5">
              {briefing.documentType ? (
                <span className="rounded-sharp bg-input px-2.5 py-1 text-caption font-medium text-foreground shadow-sm">
                  {briefing.documentType}
                </span>
              ) : null}
              {briefing.understanding.statusLabel ? (
                <span className="rounded-sharp bg-muted px-2.5 py-1 text-caption font-medium text-foreground shadow-sm">
                  {briefing.understanding.statusLabel}
                </span>
              ) : briefing.outcome !== "unknown" ? (
                <span className={cn("rounded-sharp px-2.5 py-1 text-caption font-medium", outcomeTone)}>
                  {intakeOutcomeLabel(briefing.outcome)}
                </span>
              ) : null}
            </div>
          ) : null}

          {preview.loading || preview.thumbnailUrl || preview.kind === "pdf" || preview.kind === "image" ? (
            <IntakeFilePreviewFrame
              kind={preview.kind}
              thumbnailUrl={preview.thumbnailUrl}
              openUrl={openUrl}
              title={displayName}
              loading={preview.loading && !preview.thumbnailUrl}
            />
          ) : null}

          <p className="text-sm leading-relaxed text-foreground">{briefing.summary}</p>

          <dl className="divide-y divide-border/40">
            {scanStillRunning ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Reading document…
              </div>
            ) : null}
            <FactRow
              label="Type"
              value={
                briefing.typeEvidence === "document"
                  ? briefing.documentType || "Not identified"
                  : "Not confirmed"
              }
            />
            <FactRow
              label="Outcome"
              value={
                briefing.typeEvidence === "document"
                  ? briefing.understanding.statusLabel || intakeOutcomeLabel(briefing.outcome)
                  : "Not stated"
              }
            />
            <FactRow
              label="Expiry"
              value={
                briefing.expiryDate
                  ? new Date(`${briefing.expiryDate}T00:00:00`).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : briefing.understanding.withheldExpiry
                    ? "Not applied"
                    : "Not found"
              }
            />
            <FactRow
              label="Read from"
              value={
                briefing.typeEvidence === "document" || briefing.typeEvidence === "inference"
                  ? "Document text"
                  : briefing.typeEvidence === "filename"
                    ? "File name"
                    : "Not enough to read"
              }
            />
          </dl>

          {briefing.findings.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-foreground">
              {briefing.findings.map((finding) => (
                <li key={finding} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {preview.loading && !briefing.excerpt ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Reading document…
            </div>
          ) : briefing.excerpt ? (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-muted/35 px-3 py-2.5 shadow-engraved">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                From the document
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {briefing.excerpt}
              </p>
            </div>
          ) : isEmailOnly && artifact.rawText ? (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-muted/35 px-3 py-2.5 shadow-engraved">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {artifact.rawText}
              </p>
            </div>
          ) : null}

          {decision ? (
            <IntakeDecisionPanel
              decision={
                askedWhatThisIs
                  ? {
                      ...decision,
                      action_confidence: "insufficient",
                      clarifying_question: "What is this?",
                      clarifying_options: [
                        { id: "record", label: "A property document", action: "file_record" },
                        { id: "issue", label: "Something that needs fixing", action: "create_task" },
                        ...(isMemberEmail
                          ? [{ id: "knowledge" as const, label: "Guidance to keep", action: "keep_knowledge" as const }]
                          : []),
                      ],
                      recommended_action: "ask",
                    }
                  : decision
              }
              confirmedAction={confirmedAction}
              showOtherActions={showOtherActions}
              filingKnowledge={filingKnowledge}
              allowKnowledge={isMemberEmail}
              onConfirm={(action) => {
                if (action === "something_else") {
                  setAskedWhatThisIs(true);
                  setConfirmedAction(null);
                  return;
                }
                setConfirmedAction(action);
              }}
              onRun={(action) => {
                if (action === "keep_knowledge") {
                  void handleKnowledge();
                  return;
                }
                onContinue(action === "create_task" ? "report_issue" : "add_record");
              }}
              onToggleOther={() => setShowOtherActions((open) => !open)}
            />
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={dismissing}
            onClick={() => void handleDismiss()}
          >
            {dismissing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            Dismiss upload
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
