import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIntakeItems, useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import {
  triggerIntakeProcess,
  uploadIntakeFile,
} from "@/services/intake/intakeUpload";
import { cn } from "@/lib/utils";
import addToFillaIllustration from "@/assets/add-to-filla-drop.png";

const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

/** Full-size illustration (non-compact); 15% smaller than the prior 180×160 art. */
const ILLUSTRATION_H_PX = Math.round(180 * 0.85);
const ILLUSTRATION_W_PX = Math.round(160 * 0.85);
const ILLUSTRATION_DIM_DELAY_MS = 20_000;
const ILLUSTRATION_DIM_OPACITY = 0.5;

interface AddToFillaDropPanelProps {
  className?: string;
  /** Smaller layout for minimised workbench toolbar */
  compact?: boolean;
  /**
   * Tasks → Messages tab: fixed ~100px tall drop zone (still interactive).
   * Overrides the default 220px height when not compact.
   */
  collapsedHeight?: boolean;
  onUploadComplete?: (uploadedCount: number) => void;
  /** Opens the full Add to Filla sheet (inbox, email forward, etc.) */
  onReviewClick?: () => void;
}

export function AddToFillaDropPanel({
  className,
  compact = false,
  collapsedHeight = false,
  onUploadComplete,
  onReviewClick,
}: AddToFillaDropPanelProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const invalidateIntakeItems = useIntakeItemsInvalidator();
  const { data: readyItems = [] } = useIntakeItems("ready");
  const readyCount = readyItems.length;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState(0);
  const [lastFailures, setLastFailures] = useState<string[]>([]);
  const [illustrationDimmed, setIllustrationDimmed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setIllustrationDimmed(true), ILLUSTRATION_DIM_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const uploadSingleFile = async (file: File) => {
    if (!orgId) {
      throw new Error("Active organisation not found");
    }
    const item = await uploadIntakeFile(supabase, { orgId, file });
    void triggerIntakeProcess(supabase, item.id);
    return item;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!orgId) {
      toast({
        title: "Upload unavailable",
        description: "Choose an active organisation first.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const failures: string[] = [];
    let uploaded = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          await uploadSingleFile(file);
          uploaded += 1;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : `Failed to upload "${file.name}"`);
        }
      }
    } finally {
      setUploading(false);
      setLastUploaded(uploaded);
      setLastFailures(failures);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    if (uploaded > 0) {
      void invalidateIntakeItems();
      onUploadComplete?.(uploaded);
    }

    if (uploaded > 0 && failures.length === 0) {
      toast({
        title: "Added to Filla",
        description: `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded — AI is processing.`,
      });
      return;
    }

    if (uploaded > 0 && failures.length > 0) {
      toast({
        title: "Partial upload",
        description: `${uploaded} uploaded, ${failures.length} failed.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Upload failed",
      description: failures[0] || "No files were uploaded.",
      variant: "destructive",
    });
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    void handleFiles(event.dataTransfer.files);
  };

  const panelHeightClass = compact
    ? null
    : collapsedHeight
      ? "h-[100px]"
      : "h-[220px]";
  const illustrationH = collapsedHeight
    ? Math.round(ILLUSTRATION_H_PX * 0.55)
    : ILLUSTRATION_H_PX;
  const illustrationW = collapsedHeight
    ? Math.round(ILLUSTRATION_W_PX * 0.55)
    : ILLUSTRATION_W_PX;

  return (
    <section className={cn("min-w-0", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={DEFAULT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!uploading) fileInputRef.current?.click();
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative w-full rounded-xl text-left transition-all cursor-pointer",
          compact
            ? "bg-background/90 shadow-e1 px-3 py-2.5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.65),2px_3px_6px_rgba(174,174,178,0.18)]"
            : cn(
                "border-2 border-white pl-1 pr-4 shadow-[2px_3px_2px_0px_rgba(255,255,255,0.5),-1px_-2px_2px_1px_rgba(0,0,0,0.05)]",
                panelHeightClass
              ),
          dragActive && "ring-2 ring-primary/50",
          !dragActive && "hover:ring-1 hover:ring-primary/35",
          uploading && "opacity-80 cursor-progress"
        )}
      >
        <div
          className={cn(
            "flex items-center min-w-0",
            compact
              ? "gap-3"
              : cn(
                  "justify-center gap-[15px] px-1",
                  collapsedHeight ? "h-[100px]" : "h-[220px]"
                )
          )}
        >
          <div
            className={cn(
              "shrink-0 flex items-center justify-center rounded-[10px]",
              compact ? "h-12 w-12 bg-primary/10" : undefined
            )}
            style={
              compact
                ? undefined
                : { height: illustrationH, width: illustrationW }
            }
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary-deep" />
            ) : (
              <img
                src={addToFillaIllustration}
                alt=""
                className={cn(
                  "object-contain transition-opacity duration-700 ease-in-out motion-reduce:transition-none",
                  compact ? "h-9 w-9" : undefined
                )}
                style={
                  compact
                    ? undefined
                    : {
                        height: illustrationH,
                        width: illustrationW,
                        opacity:
                          illustrationDimmed && !dragActive
                            ? ILLUSTRATION_DIM_OPACITY
                            : 1,
                      }
                }
                draggable={false}
              />
            )}
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-[5px]">
            <p className={cn("font-semibold text-foreground", compact || collapsedHeight ? "text-xs" : "text-sm")}>
              Add to Filla
            </p>
            <p className={cn("text-muted-foreground leading-snug", compact || collapsedHeight ? "text-2xs" : "text-xs")}>
              {uploading ? "Uploading…" : "Drop anything here. Filla will understand it."}
            </p>
            {readyCount > 0 && onReviewClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onReviewClick();
                }}
                className={cn(
                  "inline-flex items-center rounded-card bg-primary px-2 py-0.5 font-semibold text-primary-foreground",
                  compact || collapsedHeight ? "text-2xs h-[20px]" : "text-2xs h-[24px]"
                )}
              >
                {readyCount} ready to review
              </button>
            )}
          </div>
        </div>
      </div>

      {(lastUploaded > 0 || lastFailures.length > 0) && (
        <div className="mt-2 space-y-1">
          {lastUploaded > 0 && (
            <div className="text-2xs text-success-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Uploaded {lastUploaded} file{lastUploaded === 1 ? "" : "s"}.
            </div>
          )}
          {lastFailures.length > 0 && (
            <div className="text-2xs text-destructive flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <p>{lastFailures[0]}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
