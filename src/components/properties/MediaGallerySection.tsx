import { useState, useRef } from "react";
import { usePropertyPhotos } from "@/hooks/property/usePropertyPhotos";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaGallerySectionProps {
  propertyId: string;
  onImageUpdated?: () => void;
}

/**
 * Media Gallery Section
 * Lightweight gallery (same style as dashboard photo blocks)
 * Small thumbnails grid with Add Photo button
 */
export function MediaGallerySection({
  propertyId,
  onImageUpdated,
}: MediaGallerySectionProps) {
  const { photos } = usePropertyPhotos(propertyId);
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading: isUploadingImage } = useFileUpload({
    bucket: "property-images",
    generateThumbnail: true,
    recordId: propertyId,
    table: "properties",
    onSuccess: async (url, thumbnailUrl) => {
      if (propertyId) {
        try {
          await supabase.rpc("replace_property_image", {
            p_property_id: propertyId,
            p_new_storage_path: url,
            p_new_thumbnail_path: thumbnailUrl || url,
            p_annotation_summary: null,
          });
        } catch (error) {
          console.error("Error creating image version record:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["properties"] });
      if (onImageUpdated) {
        onImageUpdated();
      }
    },
    onError: (error) => {
      console.error("Image upload error:", error);
      alert(`Failed to upload image: ${error.message}`);
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !propertyId || !orgId) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${orgId}/${propertyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    await uploadFile(file, fileName);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Only show if there are photos
  if (photos.length === 0) {
    return (
      <div className="flex justify-center py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-pulse" />
              Uploading...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Photo
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Media Gallery</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-pulse" />
              Uploading...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Photo
            </>
          )}
        </Button>
      </div>

      {/* Thumbnails Grid */}
      <div className="grid grid-cols-4 gap-2">
        {photos.slice(0, 8).map((photo) => (
          <div
            key={photo.id}
            className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src={photo.url}
              alt={photo.caption || "Property photo"}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

