import { useState } from "react";
import { FileText, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { useIntakeItems, useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import { ignoreIntakeItem } from "@/services/intake/intakeUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { IntakeItem } from "@/types/intake-item";
import type { IntakeSourceArtifact } from "@/types/intake-item";
import { cn } from "@/lib/utils";

export interface IntakeReviewPayload {
  description: string;
  sourceArtifact: IntakeSourceArtifact;
  aiConfidence?: number | null;
  fileSize?: number | null;
}

interface IntakeInboxPanelProps {
  className?: string;
  onReview: (payload: IntakeReviewPayload) => void;
}

function descriptionFromItem(item: IntakeItem): string {
  if (item.raw_text?.trim()) return item.raw_text.trim().slice(0, 2000);
  const extracted = item.ai_extracted;
  if (!extracted) return "";
  const ocr =
    (extracted.ocr_text as string | undefined) ||
    (extracted.title as string | undefined) ||
    "";
  return ocr.trim().slice(0, 2000);
}

function isImageItem(item: IntakeItem): boolean {
  return (item.mime_type || "").toLowerCase().startsWith("image/");
}

function IntakeInboxRow({
  item,
  onReview,
  onIgnore,
  ignoring,
}: {
  item: IntakeItem;
  onReview: (payload: IntakeReviewPayload) => void;
  onIgnore: (id: string) => void;
  ignoring: boolean;
}) {
  const isProcessing = item.status === "pending" || item.status === "processing";
  const isFailed = item.status === "failed";
  const label =
    item.ai_classification ||
    item.file_name ||
    (item.source_type === "forwarded_email" ? "Forwarded email" : "Upload");

  const handleReview = () => {
    if (!item.storage_path && !item.raw_text) return;
    onReview({
      description: descriptionFromItem(item),
      sourceArtifact: {
        intakeItemId: item.id,
        storagePath: item.storage_path,
        fileName: item.file_name,
        mimeType: item.mime_type || "text/plain",
        rawText: item.raw_text,
        sourceType: item.source_type,
        aiClassification: item.ai_classification,
        aiExtracted: item.ai_extracted,
      },
      aiConfidence: item.ai_confidence,
      fileSize: item.file_size,
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[10px] bg-card/80 px-3 py-2.5 shadow-e1",
        isFailed && "opacity-80"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : isImageItem(item) ? (
          <ImageIcon className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {isProcessing
            ? "Processing…"
            : isFailed
              ? item.error_message || "Processing failed"
              : item.file_name || (item.raw_text ? "Email body" : "")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.status === "ready" && (
          <Button type="button" size="sm" variant="default" className="h-8 px-3" onClick={handleReview}>
            Review
          </Button>
        )}
        {(item.status === "ready" || item.status === "failed") && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            disabled={ignoring}
            onClick={() => onIgnore(item.id)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function IntakeInboxPanel({ className, onReview }: IntakeInboxPanelProps) {
  const { toast } = useToast();
  const invalidate = useIntakeItemsInvalidator();
  const { data: items = [], isLoading } = useIntakeItems(["pending", "processing", "ready", "failed"]);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);

  const visible = items.filter((item) =>
    ["pending", "processing", "ready", "failed"].includes(item.status)
  );

  const handleIgnore = async (id: string) => {
    setIgnoringId(id);
    try {
      await ignoreIntakeItem(supabase, id);
      void invalidate();
    } catch (error) {
      toast({
        title: "Could not dismiss",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setIgnoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading uploads…
      </div>
    );
  }

  if (visible.length === 0) {
    return null;
  }

  const readyCount = visible.filter((i) => i.status === "ready").length;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <PanelSectionTitle as="h3" className="mb-0">
          Pending review
          {readyCount > 0 ? ` (${readyCount})` : ""}
        </PanelSectionTitle>
      </div>
      <div className="space-y-2">
        {visible.map((item) => (
          <IntakeInboxRow
            key={item.id}
            item={item}
            onReview={onReview}
            onIgnore={handleIgnore}
            ignoring={ignoringId === item.id}
          />
        ))}
      </div>
    </section>
  );
}
