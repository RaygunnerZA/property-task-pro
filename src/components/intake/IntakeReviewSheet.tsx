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
  Sparkles,
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
  intakeReviewClassification,
  intakeReviewSuggestionLabel,
  intakeReviewSuggestionReason,
  intakeReviewSummaryText,
  isImageMime,
  isPdfMime,
  suggestIntakeMode,
} from "@/lib/intakeReviewSummary";
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
  const [dismissing, setDismissing] = useState(false);

  const artifact = payload?.sourceArtifact;
  const suggestedMode = artifact ? suggestIntakeMode(artifact) : "add_record";
  const classification = artifact
    ? intakeReviewClassification(artifact, artifact.fileName ?? undefined)
    : "";
  const summary = artifact ? intakeReviewSummaryText(artifact) : "";
  const confidence = payload?.aiConfidence;
  const fileSizeLabel = formatIntakeFileSize(payload?.fileSize ?? null);
  const isImage = artifact ? isImageMime(artifact.mimeType) : false;
  const isPdf = artifact ? isPdfMime(artifact.mimeType, artifact.fileName) : false;
  const isEmailOnly = !artifact?.storagePath && !!artifact?.rawText;
  const displayName = artifact?.fileName || (isEmailOnly ? "Forwarded email" : "Upload");
  const hasFilePreview = Boolean(artifact?.storagePath && (isImage || isPdf));

  useEffect(() => {
    if (!open || !artifact?.storagePath) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

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
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, artifact?.storagePath]);

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

  if (!payload || !artifact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] pb-8 max-h-[92vh] overflow-y-auto">
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
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              Review document
            </SheetTitle>
          </div>
          <SheetDescription>
            Check the file below, then choose where to file it.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Document preview — full width for PDFs and images */}
          <div className="rounded-[12px] bg-card/80 shadow-e1 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {isEmailOnly ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </span>
                  ) : isImage ? (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> Photo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {isPdf ? "PDF" : "Document"}
                    </span>
                  )}
                  {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
                </div>
              </div>
              {previewUrl ? (
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-xs" asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open
                  </a>
                </Button>
              ) : null}
            </div>

            {previewLoading ? (
              <div className="flex min-h-[200px] items-center justify-center bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : hasFilePreview && previewUrl ? (
              isImage ? (
                <div className="bg-muted/20 p-2">
                  <img
                    src={previewUrl}
                    alt={displayName}
                    className="mx-auto max-h-[min(45vh,400px)] w-full object-contain rounded-md"
                  />
                </div>
              ) : isPdf ? (
                <div className="bg-muted/20">
                  <iframe
                    src={`${previewUrl}#toolbar=1&navpanes=0`}
                    title={displayName}
                    className="h-[min(50vh,440px)] w-full border-0 bg-white"
                  />
                  <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border/30">
                    Preview not showing? Use <strong className="font-medium">Open</strong> above — some mobile browsers need the full tab.
                  </p>
                </div>
              ) : null
            ) : isEmailOnly && artifact.rawText ? (
              <div className="max-h-48 overflow-y-auto p-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {artifact.rawText}
              </div>
            ) : (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 bg-muted/30 p-4 text-center">
                <FileText className="h-10 w-10 text-primary/50" />
                <p className="text-xs text-muted-foreground">Preview unavailable — you can still file this document.</p>
              </div>
            )}
          </div>

          {/* AI read */}
          <div className="rounded-[12px] bg-[#8DC9CE]/10 px-4 py-3 shadow-e1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5a9ea3]">
                Filla read
              </span>
              <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground shadow-sm">
                {classification}
              </span>
              {confidence != null && confidence > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {Math.round(confidence * 100)}% confidence
                </span>
              ) : null}
            </div>
            {summary ? (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Limited text extracted — use the preview above to confirm before filing.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Suggested: <span className="font-medium text-foreground">{intakeReviewSuggestionLabel(suggestedMode)}</span>
              {" — "}
              {intakeReviewSuggestionReason(artifact, suggestedMode)}
            </p>
          </div>

          {/* Filing choices */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-0.5">Where should this go?</p>
            <button
              type="button"
              onClick={() => onContinue("add_record")}
              className={cn(
                intakeAddRecordDrawerCardClassName,
                suggestedMode === "add_record" && "ring-2 ring-[#8DC9CE]/60 ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold">Add to Records</p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">
                    Certificates, invoices, leases, and property documents
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onContinue("report_issue")}
              className={cn(
                intakeReportIssueDrawerCardClassName,
                suggestedMode === "report_issue" && "ring-2 ring-[#ff6b6b]/50 ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-start gap-3">
                <Plus className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold">Report an issue</p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">
                    Something needs fixing, inspection, or follow-up work
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
