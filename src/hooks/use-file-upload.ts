import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";
import { track } from "@/lib/analytics";

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

type UploadMutationResult = {
  attachment: { id: string };
  publicUrl: string;
  orgId: string;
  fileName: string;
};

/**
 * Hook for uploading files to tasks
 * Uploads to task-images bucket and creates attachment records
 *
 * `document_uploaded` analytics fire from the upload mutation `onSuccess`
 * (per @Docs/24_Phase1_Observability_Spec).
 */
export function useFileUpload({ taskId, propertyId, onUploadComplete, onError }: UseFileUploadOptions = {}) {
  const { orgId } = useActiveOrg();
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

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadMutationResult> => {
      if (!orgId) throw new Error("Organization ID not found");
      if (!taskId) throw new Error("Task ID is required");

      validateImageFile(file);

      const fileExt = file.name.split(".").pop() || "bin";
      const fileName = `org/${orgId}/tasks/${taskId}/${crypto.randomUUID()}.${fileExt}`;

      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, progress: 0, status: "uploading" as const } : p
        )
      );

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, progress: 50, status: "processing" as const } : p
        )
      );

      const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(fileName);

      const { data: attachmentData, error: attachError } = await supabase.rpc("create_attachment_record", {
        p_org_id: orgId,
        p_file_url: urlData.publicUrl,
        p_parent_type: "task",
        p_parent_id: taskId,
        p_file_name: file.name,
        p_file_type: file.type,
        p_file_size: file.size,
        p_thumbnail_url: null,
      });

      if (attachError) {
        if (import.meta.env.DEV) {
          console.warn("[use-file-upload] Attachment RPC error:", attachError.message);
        }
        throw new Error(`Failed to create attachment: ${attachError.message}`);
      }

      const attachment = Array.isArray(attachmentData) ? attachmentData[0] : attachmentData;

      if (!attachment) {
        throw new Error("Failed to create attachment: no data returned");
      }

      if (file.type.startsWith("image/")) {
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

      return {
        attachment: { id: attachment.id as string },
        publicUrl: urlData.publicUrl,
        orgId,
        fileName: file.name,
      };
    },
    onSuccess: (data) => {
      track("document_uploaded", {
        org_id: data.orgId,
        document_type: "task_image",
        via_ai: false,
      });
      onUploadComplete?.(data.attachment.id, data.publicUrl);
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === data.fileName ? { ...p, progress: 100, status: "complete" as const } : p
        )
      );
      setTimeout(() => {
        setProgress((prev) => prev.filter((p) => p.fileName !== data.fileName));
      }, 2000);
    },
    onError: (error, file) => {
      const message = error instanceof Error ? error.message : String(error);
      setProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, status: "error" as const, error: message } : p
        )
      );
      onError?.(error instanceof Error ? error : new Error(message));
    },
  });

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
    } catch (validationError: unknown) {
      const error =
        validationError instanceof Error
          ? validationError
          : new Error(`File "${file.name}" could not be uploaded.`);
      onError?.(error);
      throw error;
    }

    setProgress((prev) => [...prev, { fileName: file.name, progress: 0, status: "uploading" }]);

    return uploadMutation.mutateAsync(file);
  };

  const uploadFiles = async (files: File[]) => {
    return Promise.all(files.map((file) => uploadFile(file)));
  };

  return {
    uploadFile,
    uploadFiles,
    uploading: uploadMutation.isPending,
    progress,
  };
}
