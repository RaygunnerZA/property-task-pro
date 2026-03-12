import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, SquarePen, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TempImage, UploadStatus } from "@/types/temp-image";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { ImageAnnotationEditor } from "@/components/tasks/ImageAnnotationEditor";
import type { Annotation } from "@/types/image-annotations";
import { useToast } from "@/hooks/use-toast";

export interface PendingTaskFile {
  local_id: string;
  file: File;
  display_name: string;
  file_size: number;
  file_type: string;
}

interface ImageUploadSectionProps {
  images: TempImage[];
  onImagesChange: (images: TempImage[]) => void;
  files: PendingTaskFile[];
  onFilesChange: (files: PendingTaskFile[]) => void;
  taskId?: string; // Only set after task creation
}

export function ImageUploadSection({ 
  images, 
  onImagesChange, 
  files,
  onFilesChange,
  taskId 
}: ImageUploadSectionProps) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    return () => {
      images.forEach(cleanupTempImage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = async (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;

    const nextImages = [...images];
    const newFiles: PendingTaskFile[] = [];
    const imageJobs: Promise<void>[] = [];
    let oversizedCount = 0;
    const commitImages = () => onImagesChange([...nextImages]);

    for (const file of Array.from(incomingFiles)) {
      if (file.size > MAX_FILE_SIZE) {
        oversizedCount += 1;
        continue;
      }

      if (!file.type.startsWith("image/")) {
        newFiles.push({
          local_id: crypto.randomUUID(),
          file,
          display_name: file.name,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
        });
        continue;
      }

      const localId = crypto.randomUUID();
      const provisionalUrl = URL.createObjectURL(file);
      const provisionalImage: TempImage = {
        local_id: localId,
        display_name: file.name,
        original_file: file,
        thumbnail_blob: file,
        optimized_blob: file,
        annotation_json: [],
        uploaded: false,
        upload_status: "pending",
        thumbnail_url: provisionalUrl,
        optimized_url: provisionalUrl,
      };
      // Instant preview path: add a provisional image immediately, then upgrade it.
      nextImages.push(provisionalImage);
      commitImages();

      const job = createTempImage(file)
        .then((tempImage) => {
          const idx = nextImages.findIndex((img) => img.local_id === localId);
          if (idx === -1) {
            cleanupTempImage(tempImage);
            return;
          }
          const existing = nextImages[idx];
          if (existing.thumbnail_url === existing.optimized_url && existing.thumbnail_url) {
            URL.revokeObjectURL(existing.thumbnail_url);
          } else {
            if (existing.thumbnail_url) URL.revokeObjectURL(existing.thumbnail_url);
            if (existing.optimized_url) URL.revokeObjectURL(existing.optimized_url);
          }
          nextImages[idx] = {
            ...tempImage,
            local_id: localId,
            display_name: existing.display_name,
            original_file: existing.original_file,
            annotation_json: existing.annotation_json ?? [],
            uploaded: existing.uploaded,
            upload_status: existing.upload_status ?? "pending",
          };
          commitImages();
        })
        .catch((error) => {
          console.error(`Failed to process "${file.name}":`, error);
          const idx = nextImages.findIndex((img) => img.local_id === localId);
          if (idx !== -1) {
            const failed = nextImages[idx];
            nextImages[idx] = {
              ...failed,
              upload_status: "failed",
              upload_error: "Image processing failed",
            };
            commitImages();
          }
        });
      imageJobs.push(job);
    }

    if (imageJobs.length > 0) {
      await Promise.allSettled(imageJobs);
    }

    if (oversizedCount > 0) {
      toast({
        title: "File too large",
        description: `${oversizedCount} file${oversizedCount === 1 ? "" : "s"} exceeded 50MB.`,
        variant: "destructive",
      });
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    cleanupTempImage(imageToRemove);
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateImageAnnotations = (index: number, annotations: Annotation[]) => {
    const updated = [...images];
    updated[index] = {
      ...updated[index],
      annotation_json: annotations,
    };
    onImagesChange(updated);
  };

  const removeFile = (localId: string) => {
    onFilesChange(files.filter((file) => file.local_id !== localId));
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
    handleFileSelect(event.dataTransfer.files);
  };

  const getStatusIcon = (status?: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-400" />;
      case 'uploaded':
        return <div className="h-3 w-3 bg-green-500 rounded-full" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-3", images.length === 0 && files.length === 0 && "min-h-[65px]")}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !dragActive && fileInputRef.current?.click()}
        className={cn(
          "relative min-h-[65px] rounded-[12px] border-2 border-dashed border-white/90 bg-muted/35 transition-colors",
          "flex items-start justify-start px-4 pr-[88px] pt-[13px] pb-5 cursor-pointer",
          dragActive && "bg-primary/15 border-white"
        )}
      >
        <div className="text-left min-w-0 flex-1 pointer-events-none">
          <p className="text-[12px] font-normal text-muted-foreground pr-[5px] leading-[17px]">
            Drag & Drop or Choose File to upload
          </p>
          <p className="mt-1 text-[10px] text-primary">50 MB max file size</p>
        </div>
        <div className="absolute top-3 right-3 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              cameraInputRef.current?.click();
            }}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all"
            title="Take photo"
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all"
            title="Upload file"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image, idx) => (
            <div 
              key={image.local_id} 
              className="relative group aspect-square rounded-[8px] overflow-hidden shadow-e1"
            >
              <img
                src={image.thumbnail_url}
                alt={image.display_name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageIndex(idx);
                  setShowAnnotationEditor(true);
                }}
                className="absolute bottom-1 right-1 p-1.5 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Annotate image"
              >
                <SquarePen className="h-3 w-3" />
              </button>
              {image.upload_status && image.upload_status !== 'pending' && (
                <div className="absolute top-1 left-1 p-1 bg-black/50 rounded">
                  {getStatusIcon(image.upload_status)}
                </div>
              )}
              {image.annotation_json && image.annotation_json.length > 0 && (
                <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/50 px-1 rounded">
                  {image.annotation_json.length}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.local_id}
              className="flex items-center gap-2 rounded-[8px] bg-muted/40 px-3 py-2 shadow-e1"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{file.display_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.local_id)}
                className="p-1 rounded-full hover:bg-muted"
                title="Remove file"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Annotation Editor - works with temp images */}
      {showAnnotationEditor && editingImageIndex !== null && images[editingImageIndex] && (
        <TempImageAnnotationEditor
          tempImage={images[editingImageIndex]}
          onSave={(annotations, isAutosave) => {
            updateImageAnnotations(editingImageIndex, annotations);
            if (!isAutosave) {
              setShowAnnotationEditor(false);
              setEditingImageIndex(null);
            }
          }}
          onCancel={() => {
            setShowAnnotationEditor(false);
            setEditingImageIndex(null);
          }}
        />
      )}
    </div>
  );
}

// Annotation editor for temp images (before task creation)
function TempImageAnnotationEditor({
  tempImage,
  onSave,
  onCancel,
}: {
  tempImage: TempImage;
  onSave: (annotations: Annotation[], isAutosave: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <ImageAnnotationEditor
      imageUrl={tempImage.optimized_url || tempImage.thumbnail_url || ''}
      imageId={tempImage.local_id} // Use local_id as identifier
      taskId={''} // No task yet
      initialAnnotations={tempImage.annotation_json || []}
      onSave={async (annotations, isAutosave) => {
        // For temp images, always save (autosave or manual)
        onSave(annotations, Boolean(isAutosave));
      }}
      onCancel={onCancel}
    />
  );
}
