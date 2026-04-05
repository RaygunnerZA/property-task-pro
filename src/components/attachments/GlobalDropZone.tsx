import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, UploadCloud } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";

interface GlobalDropZoneProps {
  className?: string;
  onUploadComplete?: (uploadedCount: number) => void;
}

const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);

export function GlobalDropZone({ className, onUploadComplete }: GlobalDropZoneProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState(0);
  const [lastFailures, setLastFailures] = useState<string[]>([]);

  const uploadSingleFile = async (file: File) => {
    if (!orgId) {
      throw new Error("Active organisation not found");
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" exceeds 50MB limit`);
    }

    const sourceId = crypto.randomUUID();
    const cleanedName = sanitizeFileName(file.name) || `upload-${Date.now()}`;
    const storagePath = `orgs/${orgId}/inbox/${sourceId}/${Date.now()}-${cleanedName}`;

    const { error: uploadError } = await supabase.storage
      .from("inbox")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw new Error(`Upload failed for "${file.name}": ${uploadError.message}`);
    }

    const { error: sourceError } = await supabase.rpc("create_compliance_source_from_inbox", {
      p_id: sourceId,
      p_storage_path: storagePath,
      p_file_name: file.name,
      p_mime_type: file.type || null,
      p_file_size: file.size,
      p_source: "global_dropzone",
    });

    if (sourceError) {
      const { error: cleanupError } = await supabase.storage.from("inbox").remove([storagePath]);
      if (cleanupError) {
        throw new Error(
          `Failed to create source record for "${file.name}" and cleanup failed: ${cleanupError.message}`
        );
      }
      throw new Error(`Failed to create source record for "${file.name}": ${sourceError.message}`);
    }
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
      onUploadComplete?.(uploaded);
    }

    if (uploaded > 0 && failures.length === 0) {
      toast({
        title: "Inbox updated",
        description: `${uploaded} file${uploaded === 1 ? "" : "s"} added to inbox intake.`,
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
    <section className={cn("rounded-[12px] bg-card/70 shadow-e1 p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4 text-primary" />
        <PanelSectionTitle as="h3" className="mb-0">
          Inbox Intake Bucket
        </PanelSectionTitle>
      </div>

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
          "rounded-[10px] p-8 text-center transition-all cursor-pointer bg-input",
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
            {uploading ? "Uploading to inbox..." : "Drop files here or click to add"}
          </p>
          <p className="text-xs text-muted-foreground">
            Documents and images are stored in the org inbox bucket
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
