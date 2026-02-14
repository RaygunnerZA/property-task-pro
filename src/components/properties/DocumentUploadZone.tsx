import { useRef, useState } from "react";
import { Upload, Loader2, Camera } from "lucide-react";
import { useDocumentUpload } from "@/hooks/property/useDocumentUpload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DocumentUploadZoneProps {
  propertyId: string;
  onUploadComplete?: () => void;
  accept?: string;
  className?: string;
}

const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

export function DocumentUploadZone({
  propertyId,
  onUploadComplete,
  accept = DEFAULT_ACCEPT,
  className,
}: DocumentUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { upload, uploading } = useDocumentUpload(propertyId);
  const { toast } = useToast();

  const isMobile = typeof window !== "undefined" && "ontouchstart" in window;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const created = await upload(Array.from(files));
      toast({
        title: "Upload complete",
        description: `${created.length} document(s) uploaded`,
      });
      onUploadComplete?.();
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message || "Failed to upload",
        variant: "destructive",
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Desktop: drag & drop */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative border-2 border-dashed rounded-[8px] p-8 text-center cursor-pointer transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50",
          "flex flex-col items-center justify-center gap-2"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drag & drop documents here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, images, Word, Excel, TXT, CSV
            </p>
            {isMobile && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Tap to use camera or file picker
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
