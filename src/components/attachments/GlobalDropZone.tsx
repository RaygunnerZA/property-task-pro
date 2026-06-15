import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, UploadCloud } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import {
  triggerIntakeProcess,
  uploadIntakeFile,
} from "@/services/intake/intakeUpload";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";

interface GlobalDropZoneProps {
  className?: string;
  /** Compact layout for action sheets */
  compact?: boolean;
  onUploadComplete?: (uploadedCount: number) => void;
}

const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

export function GlobalDropZone({ className, compact = false, onUploadComplete }: GlobalDropZoneProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const invalidateIntakeItems = useIntakeItemsInvalidator();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState(0);
  const [lastFailures, setLastFailures] = useState<string[]>([]);

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
    handleFiles(event.dataTransfer.files);
  };

  return (
    <section className={cn(compact ? "p-0" : "rounded-[12px] bg-card/70 shadow-e1 p-4", className)}>
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-4 w-4 text-primary" />
          <PanelSectionTitle as="h3" className="mb-0">
            Upload
          </PanelSectionTitle>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={DEFAULT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "rounded-[10px] text-center transition-all cursor-pointer bg-input",
          compact ? "p-6" : "p-8",
          "shadow-[inset_2px_2px_5px_rgba(0,0,0,0.08),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]",
          dragActive && "ring-2 ring-primary/40",
          !dragActive && "hover:ring-1 hover:ring-primary/30",
          uploading && "opacity-75 cursor-progress"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-8 w-8 text-primary" />
          )}
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Uploading…" : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground">
            Photos, PDFs, and documents up to 50MB
          </p>
        </div>
      </div>

      {(lastUploaded > 0 || lastFailures.length > 0) && (
        <div className="mt-3 space-y-2">
          {lastUploaded > 0 && (
            <div className="text-xs text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Uploaded {lastUploaded} file{lastUploaded === 1 ? "" : "s"}.
            </div>
          )}
          {lastFailures.length > 0 && (
            <div className="text-xs text-destructive flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                {lastFailures.slice(0, 3).map((failure, idx) => (
                  <p key={`${failure}-${idx}`}>{failure}</p>
                ))}
                {lastFailures.length > 3 && <p>+{lastFailures.length - 3} more errors</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
