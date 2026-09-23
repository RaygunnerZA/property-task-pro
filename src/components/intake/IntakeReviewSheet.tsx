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
import { formatIntakeFileSize, suggestIntakeMode } from "@/lib/intakeReviewSummary";
import {
  inboundEmailOutcomeLabel,
  inboundEmailSenderLabel,
  readInboundEmailProposal,
} from "@/lib/intake/inboundEmailProposal";
import {
  buildIntakeDocumentBriefing,
  intakeOutcomeLabel,
  intakeReadFromLabel,
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
  onContinue: (mode: IntakeMode) => void;
  onBackToUploads?: () => void;
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
  onContinue,
  onBackToUploads,
}: IntakeReviewSheetProps) {
  const { toast } = useToast();
  const invalidate = useIntakeItemsInvalidator();
  const [dismissing, setDismissing] = useState(false);
  const [filingKnowledge, setFilingKnowledge] = useState(false);
  const [artifact, setArtifact] = useState<IntakeSourceArtifact | null>(payload?.sourceArtifact ?? null);
  const [itemStatus, setItemStatus] = useState<IntakeItemStatus | null>(null);

  useEffect(() => {
    setArtifact(payload?.sourceArtifact ?? null);
    setItemStatus(null);
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
  const suggestedMode =
    proposal?.outcome === "task"
      ? "report_issue"
      : proposal?.outcome === "record"
        ? "add_record"
        : artifact
          ? suggestIntakeMode(artifact)
          : "add_record";
  const briefing = artifact ? buildIntakeDocumentBriefing(artifact, preview.extractedText) : null;
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
            {briefing.needsFollowUp
              ? "File the record, then raise follow-up if the outcome needs work."
              : "Check the read, then choose where this should go."}
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

          <div className="flex flex-wrap gap-1.5">
            {briefing.documentType ? (
              <span className="rounded-sharp bg-input px-2.5 py-1 text-caption font-medium text-foreground shadow-sm">
                {briefing.documentType}
              </span>
            ) : null}
            {briefing.outcome !== "unknown" ? (
              <span className={cn("rounded-sharp px-2.5 py-1 text-caption font-medium", outcomeTone)}>
                {intakeOutcomeLabel(briefing.outcome)}
              </span>
            ) : null}
          </div>

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
            <FactRow label="Type" value={briefing.documentType || "Not identified"} />
            <FactRow label="Outcome" value={intakeOutcomeLabel(briefing.outcome)} />
            <FactRow
              label="Expiry"
              value={
                briefing.expiryDate
                  ? new Date(`${briefing.expiryDate}T00:00:00`).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not found"
              }
            />
            <FactRow label="Read from" value={intakeReadFromLabel(briefing.provenance)} />
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

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Where should this go?</p>
            <button
              type="button"
              onClick={() => onContinue("add_record")}
              className={cn(
                intakeAddRecordDrawerCardClassName,
                suggestedMode === "add_record" && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold">Add to Records</p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">
                    {briefing.documentType
                      ? `Keep this ${briefing.documentType} on the property file`
                      : "Certificates, invoices, leases, and property documents"}
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onContinue("report_issue")}
              className={cn(
                intakeReportIssueDrawerCardClassName,
                suggestedMode === "report_issue" && "ring-2 ring-destructive/50 ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-start gap-3">
                <Plus className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold">
                    {proposal?.task_fields?.reminder ? "Create a reminder" : "Report an issue"}
                  </p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">
                    {proposal?.task_fields?.reminder
                      ? "A task with the proposed due date. You can change the date before saving."
                      : briefing.needsFollowUp
                        ? "Unsatisfactory or expired — raise remedial or renewal work"
                        : "Something needs fixing, inspection, or follow-up work"}
                  </p>
                </div>
              </div>
            </button>
            {isMemberEmail ? (
              <button
                type="button"
                disabled={filingKnowledge}
                onClick={() => void handleKnowledge()}
                className={cn(
                  "w-full rounded-lg border-0 bg-card p-4 text-left text-foreground shadow-e1 transition-all hover:bg-card/80",
                  proposal?.outcome === "knowledge" && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
                )}
              >
                <div className="flex items-start gap-3">
                  {filingKnowledge ? (
                    <Loader2 className="h-5 w-5 shrink-0 mt-0.5 animate-spin text-primary" />
                  ) : (
                    <BookOpen className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                  )}
                  <div className="text-left">
                    <p className="font-semibold">Keep as Knowledge</p>
                    <p className="text-xs font-normal mt-0.5 text-muted-foreground">
                      Reusable guidance for this organisation. It stays a candidate until it is reviewed.
                    </p>
                  </div>
                </div>
              </button>
            ) : null}
          </div>

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
