import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

interface UseFileUploadOptions {
  taskId?: string;
  onUploadComplete?: (attachmentId: string, fileUrl: string) => void;
  onError?: (error: Error) => void;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

/**
 * Hook for uploading files to tasks
 * Uploads to task-images bucket and creates attachment records
 */
export function useFileUpload({ taskId, onUploadComplete, onError }: UseFileUploadOptions = {}) {
  const { orgId } = useActiveOrg();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);

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

    // Check file size (10MB limit for task-images bucket per migration)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (10485760 bytes)
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      const error = new Error(`File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is 10MB. Please compress or resize the image.`);
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
      const { data: attachmentData, error: attachError } = await supabase
        .from("attachments")
        .insert({
          org_id: orgId,
          parent_type: "task",
          parent_id: taskId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (attachError || !attachmentData) {
        throw new Error(`Failed to create attachment: ${attachError?.message || "Unknown error"}`);
      }

      // Step 4: Trigger thumbnail generation (async, don't wait)
      if (file.type.startsWith("image/")) {
        // Call optimize-image edge function asynchronously
        supabase.functions
          .invoke("optimize-image", {
            body: {
              bucket: "task-images",
              path: fileName,
              recordId: attachmentData.id,
              table: "attachments",
            },
          })
          .catch((err) => {
            console.error("Thumbnail generation failed (non-critical):", err);
            // Don't throw - thumbnail generation is optional
          });
      }

      // Update progress to complete
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, progress: 100, status: "complete" } : p
        )
      );

      onUploadComplete?.(attachmentData.id, urlData.publicUrl);

      // Remove from progress after a delay
      setTimeout(() => {
        setProgress((prev) => prev.filter((p) => p.fileName !== file.name));
      }, 2000);

      return attachmentData;
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

