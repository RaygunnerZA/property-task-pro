import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

interface UseFileUploadOptions {
  taskId?: string;
  propertyId?: string | null;
  onUploadComplete?: (attachmentId: string, fileUrl: string) => void;
  onError?: (error: Error) => void;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "heif"]);

const getFileExtension = (fileName: string) =>
  (fileName.split(".").pop() || "").trim().toLowerCase();

/**
 * Hook for uploading files to tasks
 * Uploads to task-images bucket and creates attachment records
 *
 * Debug logging: All console output is wrapped in import.meta.env.DEV.
 * No debug code (e.g. fetch to localhost) should run in production.
 */
export function useFileUpload({ taskId, propertyId, onUploadComplete, onError }: UseFileUploadOptions = {}) {
  const { orgId } = useActiveOrg();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);

  const validateImageFile = (file: File) => {
    const extension = getFileExtension(file.name);
    const mime = (file.type || "").toLowerCase();

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      throw new Error(
        `File "${file.name}" is ${fileSizeMB}MB. Task image uploads are limited to 10MB per file.`
      );
    }

    const mimeAllowed = mime ? ALLOWED_IMAGE_MIME_TYPES.has(mime) : false;
    const extensionAllowed = ALLOWED_IMAGE_EXTENSIONS.has(extension);
    if (!mimeAllowed && !extensionAllowed) {
      throw new Error(
        `File "${file.name}" is not supported. Accepted formats: HEIC, PNG, JPG/JPEG.`
      );
    }
  };

  const uploadFile = async (file: File) => {
    if (!orgId) {
      const error = new Error("Organization ID not found");
      onError?.(error);
      throw error;
    }

    if (!taskId) {
      const error = new Error("Task ID is required");
      onError?.(error);
      throw error;
    }

    try {
      validateImageFile(file);
    } catch (validationError: any) {
      const error = validationError instanceof Error
        ? validationError
        : new Error(`File "${file.name}" could not be uploaded.`);
      onError?.(error);
      throw error;
    }

    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `org/${orgId}/tasks/${taskId}/${crypto.randomUUID()}.${fileExt}`;

    // Add to progress tracking
    const progressItem: UploadProgress = {
      fileName: file.name,
      progress: 0,
      status: "uploading",
    };
    setProgress((prev) => [...prev, progressItem]);

    try {
      setUploading(true);

      // Step 1: Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Update progress
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, progress: 50, status: "processing" } : p
        )
      );

      // Step 2: Get public URL
      const { data: urlData } = supabase.storage
        .from("task-images")
        .getPublicUrl(fileName);

      // Step 3: Create attachment record
      if (!orgId) {
        throw new Error("Organization ID is required but not available");
      }

      // Use RPC function to create attachment (bypasses RLS)
      const { data: attachmentData, error: attachError } = await supabase.rpc('create_attachment_record', {
        p_org_id: orgId,
        p_file_url: urlData.publicUrl,
        p_parent_type: "task",
        p_parent_id: taskId,
        p_file_name: file.name,
        p_file_type: file.type,
        p_file_size: file.size,
        p_thumbnail_url: null
      });

      if (attachError) {
        if (import.meta.env.DEV) {
          console.warn("[use-file-upload] Attachment RPC error:", attachError.message);
        }
        throw new Error(`Failed to create attachment: ${attachError.message}`);
      }
      
      // RPC returns an array, get first element
      const attachment = Array.isArray(attachmentData) ? attachmentData[0] : attachmentData;
      
      if (!attachment) {
        throw new Error("Failed to create attachment: no data returned");
      }

      // Step 4: Trigger thumbnail generation (async, don't wait)
      if (file.type.startsWith("image/")) {
        // Call optimize-image edge function asynchronously
        supabase.functions
          .invoke("optimize-image", {
            body: {
              bucket: "task-images",
              path: fileName,
              recordId: attachment.id,
              table: "attachments",
            },
          })
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn("Thumbnail generation failed (non-critical):", err);
            }
          });

        // Step 5: Fire-and-forget AI image analysis (never blocks upload UX)
        if (orgId && attachment.id) {
          supabase.functions
            .invoke("ai-image-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: urlData.publicUrl,
                org_id: orgId,
                property_id: propertyId ?? null,
                task_id: taskId ?? null,
              },
            })
            .then(({ error }) => {
              if (error && import.meta.env.DEV) {
                console.warn("[use-file-upload] AI image analysis failed:", error);
              }
            })
            .catch(() => {});
        }
      }

      // Update progress to complete
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, progress: 100, status: "complete" } : p
        )
      );

      onUploadComplete?.(attachment.id, urlData.publicUrl);

      // Remove from progress after a delay
      setTimeout(() => {
        setProgress((prev) => prev.filter((p) => p.fileName !== file.name));
      }, 2000);

      return attachment;
    } catch (error: any) {
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name
            ? { ...p, status: "error", error: error.message }
            : p
        )
      );

      onError?.(error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    return Promise.all(files.map((file) => uploadFile(file)));
  };

  return {
    uploadFile,
    uploadFiles,
    uploading,
    progress,
  };
}

