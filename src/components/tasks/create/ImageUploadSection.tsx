import { useState, useRef } from "react";
import { ImagePlus, X, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CreateTaskImagePayload } from "@/types/database";

interface ImageUploadSectionProps {
  images: CreateTaskImagePayload[];
  onImagesChange: (images: CreateTaskImagePayload[]) => void;
}

export function ImageUploadSection({ images, onImagesChange }: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: CreateTaskImagePayload = {
          storage_path: `temp/${crypto.randomUUID()}`,
          image_url: e.target?.result as string,
          original_filename: file.name,
          display_name: file.name,
          file_type: file.type,
        };
        onImagesChange([...images, newImage]);
      };
      reader.readAsDataURL(file);
    });
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

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium flex items-center gap-2">
        <ImagePlus className="h-4 w-4 text-muted-foreground" />
        Images
      </Label>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer",
          dragActive 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex gap-2">
            <div className="p-2 rounded-full bg-muted">
              <Camera className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-2 rounded-full bg-muted">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tap to take photo or upload
          </p>
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image, idx) => (
            <div 
              key={idx} 
              className="relative group aspect-square rounded-lg overflow-hidden shadow-e1"
            >
              <img
                src={image.image_url}
                alt={image.display_name || "Task image"}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              {/* Annotation indicator placeholder */}
              <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/50 px-1 rounded">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
