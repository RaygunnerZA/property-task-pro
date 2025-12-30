import { useRef, useState, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  taskId: string;
  onUploadComplete?: () => void;
  accept?: string;
  className?: string;
}

export function FileUploadZone({
  taskId,
  onUploadComplete,
  accept = "image/*",
  className,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  
  const { uploadFiles, uploading, progress } = useFileUpload({
    taskId,
    onUploadComplete: () => {
      onUploadComplete?.();
      toast({
        title: "Upload successful",
        description: "Image uploaded and will be optimized automatically",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    try {
      await uploadFiles(Array.from(files));
    } catch (error: any) {
      // Error is already shown via onError callback in useFileUpload
      // Don't throw to prevent unhandled promise rejection
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={uploading}
        />
        <div className="flex flex-col items-center justify-center gap-3">
          {uploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <div className="p-3 rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images will be optimized automatically
            </p>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      {progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate flex-1 mr-2">
                  {item.fileName}
                </span>
                <span className="text-muted-foreground">
                  {item.status === "complete" ? "Complete" : `${item.progress}%`}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    item.status === "error"
                      ? "bg-destructive"
                      : item.status === "complete"
                      ? "bg-primary"
                      : "bg-primary/50"
                  )}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && (
                <p className="text-xs text-destructive">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

