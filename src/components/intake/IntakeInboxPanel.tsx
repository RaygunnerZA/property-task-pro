import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { useIntakeItems, useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import { ignoreIntakeItem } from "@/services/intake/intakeUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { IntakeItem } from "@/types/intake-item";
import type { IntakeSourceArtifact } from "@/types/intake-item";
import { intakeInboxCardCopy } from "@/lib/intakeDocumentBriefing";
import { readInboundEmailProposal } from "@/lib/intake/inboundEmailProposal";
import { useInboxFilePreview } from "@/hooks/useInboxFilePreview";
import { IntakeFileThumb } from "@/components/intake/IntakeFileThumb";
import { cn } from "@/lib/utils";
import { noteResolution } from "@/lib/motion/resolutions";
import {
  ResolutionLedger,
  ResolutionLedgerProvider,
  ResolvableItem,
  ResolvableList,
  SignalMark,
  useResolutionLedger,
} from "@/components/motion";

/** Upper bound on keeping an emptied panel on screen while its last row resolves. */
const EMPTY_HOLD_MAX_MS = 6000;

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
  const proposal = readInboundEmailProposal(item.ai_extracted);
  if (proposal?.summary) return proposal.summary.slice(0, 2000);
  if (item.raw_text?.trim()) return item.raw_text.trim().slice(0, 2000);
  const extracted = item.ai_extracted;
  if (!extracted) return "";
  const ocr =
    (extracted.ocr_text as string | undefined) ||
    (extracted.title as string | undefined) ||
    "";
  return ocr.trim().slice(0, 2000);
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
  const wasProcessing = useRef(isProcessing);
  const [becameReady, setBecameReady] = useState(0);
  useEffect(() => {
    if (wasProcessing.current && item.status === "ready") setBecameReady((n) => n + 1);
    wasProcessing.current = isProcessing;
  }, [isProcessing, item.status]);
  const preview = useInboxFilePreview({
    storagePath: item.storage_path,
    mimeType: item.mime_type,
    fileName: item.file_name,
    fileSize: item.file_size,
    enabled: Boolean(item.storage_path),
  });
  const { title, insight } = intakeInboxCardCopy(item, preview.extractedText);

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
        emailProvenance: item.email_provenance,
      },
      aiConfidence: item.ai_confidence,
      fileSize: item.file_size,
    });
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-[10px] bg-card/80 px-3 py-2.5 shadow-e1",
        isFailed && "opacity-80"
      )}
    >
      {becameReady > 0 ? <SignalMark key={becameReady} tone="attention" edge="left" /> : null}
      {isProcessing ? (
        <div
          data-resolve-content
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-muted/40 shadow-e1"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : (
        <span data-resolve-content className="shrink-0">
          <IntakeFileThumb
            kind={preview.kind}
            thumbnailUrl={preview.thumbnailUrl}
            label={item.file_name || title}
            size="sm"
          />
        </span>
      )}

      <div data-resolve-content className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{insight}</p>
        {item.file_name && item.file_name !== title ? (
          <p className="truncate text-2xs text-muted-foreground/80">{item.file_name}</p>
        ) : null}
      </div>

      <div data-resolve-content className="flex shrink-0 items-center gap-1">
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

export function IntakeInboxPanel(props: IntakeInboxPanelProps) {
  return (
    <ResolutionLedgerProvider>
      <IntakeInboxPanelBody {...props} />
    </ResolutionLedgerProvider>
  );
}

/**
 * Keeps an emptied list on screen until its last row has resolved into the
 * ledger, so the final item's motion is seen rather than cut off.
 */
function useHoldWhileResolving(visibleCount: number): boolean {
  const ledger = useResolutionLedger();
  const active = Boolean(ledger?.active);
  const hadItems = useRef(false);
  const sawResolving = useRef(false);
  const [, release] = useState(0);

  if (visibleCount > 0) {
    hadItems.current = true;
    sawResolving.current = false;
  }
  if (active) sawResolving.current = true;
  if (visibleCount === 0 && hadItems.current && sawResolving.current && !active) {
    hadItems.current = false;
    sawResolving.current = false;
  }
  const holding = visibleCount === 0 && hadItems.current;

  useEffect(() => {
    if (!holding) return;
    const timer = window.setTimeout(() => {
      hadItems.current = false;
      release((n) => n + 1);
    }, EMPTY_HOLD_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [holding]);

  return holding;
}

function IntakeInboxPanelBody({ className, onReview }: IntakeInboxPanelProps) {
  const { toast } = useToast();
  const invalidate = useIntakeItemsInvalidator();
  const { data: items = [], isLoading } = useIntakeItems(["pending", "processing", "ready", "failed"]);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);

  const visible = items.filter((item) =>
    ["pending", "processing", "ready", "failed"].includes(item.status)
  );
  const holding = useHoldWhileResolving(visible.length);

  const handleIgnore = async (id: string) => {
    setIgnoringId(id);
    try {
      await ignoreIntakeItem(supabase, id);
      noteResolution("intake", id, "dismissed");
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

  if (visible.length === 0 && !holding) {
    return null;
  }

  const readyCount = visible.filter((i) => i.status === "ready").length;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <PanelSectionTitle as="h3" className="mb-0">
          Uploads to review
          {readyCount > 0 ? ` (${readyCount})` : ""}
        </PanelSectionTitle>
        <ResolutionLedger className="ml-auto" />
      </div>
      <div className="space-y-2">
        <ResolvableList>
          {visible.map((item) => (
            <ResolvableItem key={item.id} id={item.id} scope="intake">
              <IntakeInboxRow
                item={item}
                onReview={onReview}
                onIgnore={handleIgnore}
                ignoring={ignoringId === item.id}
              />
            </ResolvableItem>
          ))}
        </ResolvableList>
      </div>
    </section>
  );
}
