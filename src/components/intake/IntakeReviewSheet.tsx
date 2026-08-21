import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
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
import {
  formatIntakeFileSize,
  isImageMime,
  isPdfMime,
  suggestIntakeMode,
} from "@/lib/intakeReviewSummary";
import {
  buildIntakeDocumentBriefing,
  intakeOutcomeLabel,
  intakeReadFromLabel,
} from "@/lib/intakeDocumentBriefing";
import { extractOfficePlainText, isOfficeDocument } from "@/lib/officeDocumentText";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [officeText, setOfficeText] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const artifact = payload?.sourceArtifact;
  const suggestedMode = artifact ? suggestIntakeMode(artifact) : "add_record";
  const briefing = artifact ? buildIntakeDocumentBriefing(artifact, officeText) : null;
  const fileSizeLabel = formatIntakeFileSize(payload?.fileSize ?? null);
  const isImage = artifact ? isImageMime(artifact.mimeType) : false;
  const isPdf = artifact ? isPdfMime(artifact.mimeType, artifact.fileName) : false;
  const isEmailOnly = !artifact?.storagePath && !!artifact?.rawText;
  const displayName = artifact?.fileName || (isEmailOnly ? "Forwarded email" : "Upload");
  const hasFilePreview = Boolean(artifact?.storagePath && (isImage || isPdf));

  useEffect(() => {
    if (!open || !artifact?.storagePath) {
      setPreviewUrl(null);
      setOfficeText(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setOfficeText(null);

    void (async () => {
      try {
        const { data, error } = await supabase.storage
          .from("inbox")
          .createSignedUrl(artifact.storagePath, 3600);
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPreviewUrl(null);
          return;
        }
        setPreviewUrl(data.signedUrl);

        const shouldReadOffice =
          isOfficeDocument(artifact.mimeType, artifact.fileName) &&
          (payload?.fileSize == null || payload.fileSize <= 8 * 1024 * 1024);
        if (!shouldReadOffice) return;

        const fileRes = await fetch(data.signedUrl);
        if (!fileRes.ok || cancelled) return;
        const buffer = await fileRes.arrayBuffer();
        const text = await extractOfficePlainText(buffer, artifact.fileName);
        if (!cancelled && text.trim().length >= 12) setOfficeText(text);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, artifact?.storagePath, artifact?.mimeType, artifact?.fileName, payload?.fileSize]);

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
          <div className="flex items-start gap-3">
            {isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-card object-cover shadow-e1"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-muted/40 shadow-e1">
                {isEmailOnly ? (
                  <Mail className="h-6 w-6 text-muted-foreground" />
                ) : isImage ? (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <FileText className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground leading-snug">{briefing.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayName}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{briefing.fileKindLabel}</span>
                {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
                {previewUrl ? (
                  <a
                    href={previewUrl}
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

          <p className="text-sm leading-relaxed text-foreground">{briefing.summary}</p>

          <dl className="divide-y divide-border/40">
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

          {previewLoading ? (
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
          ) : hasFilePreview && previewUrl && isPdf ? (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0`}
              title={displayName}
              className="h-[min(32vh,280px)] w-full rounded-xl bg-white shadow-engraved"
            />
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
                  <p className="font-semibold">Report an issue</p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">
                    {briefing.needsFollowUp
                      ? "Unsatisfactory or expired — raise remedial or renewal work"
                      : "Something needs fixing, inspection, or follow-up work"}
                  </p>
                </div>
              </div>
            </button>
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
