import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, SquarePen, AlertCircle } from "lucide-react";
import type { TempImage, UploadStatus } from "@/types/temp-image";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { ImageAnnotationEditorWrapper } from "@/components/tasks/ImageAnnotationEditorWrapper";
import type { AnnotationPayload, AnnotationSavePayload } from "@/types/annotation-payload";

interface ImageUploadSectionProps {
  images: TempImage[];
  onImagesChange: (images: TempImage[]) => void;
  taskId?: string; // Only set after task creation
}

export function ImageUploadSection({ 
  images, 
  onImagesChange, 
  taskId 
}: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    return () => {
      images.forEach(cleanupTempImage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    const newImages: TempImage[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File "${file.name}" is too large`);
        continue;
      }
      
      try {
        const tempImage = await createTempImage(file);
        newImages.push(tempImage);
      } catch (error) {
        console.error(`Failed to process "${file.name}":`, error);
      }
    }
    
    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    cleanupTempImage(imageToRemove);
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateImageAnnotations = (
    index: number,
    annotations: AnnotationPayload[],
    previewDataUrl?: string
  ) => {
    const updated = [...images];
    updated[index] = {
      ...updated[index],
      annotation_json: annotations,
      annotated_preview_url: previewDataUrl ?? updated[index].annotated_preview_url,
    };
    onImagesChange(updated);
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

  const primaryImage = images[0];

  return (
    <div className="space-y-3">
      {/* Primary Image Row - 50% width, icons bottom-right */}
      {primaryImage && (
        <div className="flex gap-3 items-end">
          {/* Thumbnail - 50% width */}
          <div className="w-1/2 relative group aspect-square rounded-lg overflow-hidden shadow-e1">
            <img
              src={primaryImage.annotated_preview_url || primaryImage.thumbnail_url}
              alt={primaryImage.display_name}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(0)}
              className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
            {/* Annotation button */}
            <button
              type="button"
              onClick={() => {
                setEditingImageIndex(0);
                setShowAnnotationEditor(true);
              }}
              className="absolute bottom-1 right-1 p-1.5 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Annotate image"
            >
              <SquarePen className="h-3 w-3" />
            </button>
            {/* Upload status indicator */}
            {primaryImage.upload_status && primaryImage.upload_status !== 'pending' && (
              <div className="absolute top-1 left-1 p-1 bg-black/50 rounded">
                {getStatusIcon(primaryImage.upload_status)}
              </div>
            )}
            {/* Annotation indicator */}
            {primaryImage.annotation_json && primaryImage.annotation_json.length > 0 && (
              <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/50 px-1 rounded">
                {primaryImage.annotation_json.length} annotation{primaryImage.annotation_json.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Icons - Bottom-right aligned */}
          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
              title="Take photo"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
              title="Upload image"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* No images state */}
      {images.length === 0 && (
        <div className="flex gap-2 justify-end items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
            title="Take photo"
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
            title="Upload image"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Additional images grid */}
      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {images.slice(1).map((image, idx) => (
            <div 
              key={image.local_id} 
              className="relative group aspect-square rounded-lg overflow-hidden shadow-e1"
            >
              <img
                src={image.annotated_preview_url || image.thumbnail_url}
                alt={image.display_name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx + 1)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageIndex(idx + 1);
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Annotation Editor - works with temp images */}
      {showAnnotationEditor && editingImageIndex !== null && images[editingImageIndex] && (
        <ImageAnnotationEditorWrapper
          open={showAnnotationEditor}
          imageUrl={images[editingImageIndex].optimized_url || images[editingImageIndex].thumbnail_url || ""}
          initialAnnotations={images[editingImageIndex].annotation_json || []}
          onSave={(data: AnnotationSavePayload) => {
            updateImageAnnotations(editingImageIndex, data.annotations, data.previewDataUrl);
            setShowAnnotationEditor(false);
            setEditingImageIndex(null);
          }}
          onCancel={() => {
            setShowAnnotationEditor(false);
            setEditingImageIndex(null);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setShowAnnotationEditor(false);
              setEditingImageIndex(null);
            }
          }}
        />
      )}
    </div>
  );
}

// Annotation editor is handled by ImageAnnotationEditorWrapper (pre-upload)
