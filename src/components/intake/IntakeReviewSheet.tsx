import { useEffect, useState } from "react";
import {
  ArrowLeft,
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
  /** Re-open the upload sheet when user taps back */
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
  const isEmailOnly = !artifact?.storagePath && !!artifact?.rawText;
  const displayName = artifact?.fileName || (isEmailOnly ? "Forwarded email" : "Upload");

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
      <SheetContent side="bottom" className="rounded-t-[20px] pb-8 max-h-[90vh] overflow-y-auto">
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
              Review upload
            </SheetTitle>
          </div>
          <SheetDescription>
            Filla analysed your file. Choose where to file it before adding details.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* File preview */}
          <div className="rounded-[12px] bg-card/80 shadow-e1 overflow-hidden">
            <div className="flex items-stretch min-h-[120px]">
              <div
                className={cn(
                  "flex w-28 shrink-0 items-center justify-center bg-muted/40",
                  isImage && previewUrl && "w-32"
                )}
              >
                {previewLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : isImage && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full object-cover max-h-36"
                  />
                ) : isEmailOnly ? (
                  <Mail className="h-10 w-10 text-primary/70" />
                ) : (
                  <FileText className="h-10 w-10 text-primary/70" />
                )}
              </div>
              <div className="min-w-0 flex-1 p-3 flex flex-col justify-center gap-1">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
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
                      <FileText className="h-3 w-3" /> Document
                    </span>
                  )}
                  {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
                </div>
              </div>
            </div>
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
                No readable text extracted — you can still file this manually.
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
