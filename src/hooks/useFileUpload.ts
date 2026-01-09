import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

interface UseFileUploadOptions {
  bucket: string;
  onSuccess?: (url: string, thumbnailUrl?: string) => void;
  onError?: (error: Error) => void;
  generateThumbnail?: boolean;
  recordId?: string;
  table?: string;
}

interface UseFileUploadResult {
  uploadFile: (file: File, path?: string) => Promise<string | null>;
  isUploading: boolean;
  error: string | null;
}

/**
 * Hook for uploading files to Supabase Storage with optional thumbnail generation
 * 
 * @param options Configuration options
 * @returns Upload function and state
 */
export function useFileUpload(options: UseFileUploadOptions): UseFileUploadResult {
  const { orgId } = useActiveOrg();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, customPath?: string): Promise<string | null> => {
    if (!orgId) {
      const err = new Error("Organization not found");
      setError(err.message);
      options.onError?.(err);
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Generate file path
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = customPath || `${orgId}/${timestamp}-${randomId}.${fileExt}`;

      // Upload file to Storage
      const { error: uploadError } = await supabase.storage
        .from(options.bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL for original file
      const { data: urlData } = supabase.storage
        .from(options.bucket)
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // If thumbnail generation is enabled and we have recordId/table, trigger edge function
      let thumbnailUrl: string | undefined;
      if (options.generateThumbnail && options.recordId && options.table) {
        try {
          const { data, error: processError } = await supabase.functions.invoke(
            "process-image",
            {
              body: {
                bucket: options.bucket,
                path: fileName,
                recordId: options.recordId,
                table: options.table,
              },
            }
          );

          if (processError) {
            console.error("Thumbnail generation failed:", processError);
            // Don't fail the upload if thumbnail generation fails
          } else if (data?.ok && data?.data?.thumbnailUrl) {
            thumbnailUrl = data.data.thumbnailUrl;
          }
        } catch (thumbError: any) {
          console.error("Error calling process-image function:", thumbError);
          // Don't fail the upload if thumbnail generation fails
        }
      }

      // Call success callback
      options.onSuccess?.(publicUrl, thumbnailUrl);

      return publicUrl;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      options.onError?.(error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
    error,
  };
}

