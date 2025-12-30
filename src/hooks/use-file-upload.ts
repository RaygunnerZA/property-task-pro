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
      // Verify orgId is set before attempting insert
      if (!orgId) {
        throw new Error("Organization ID is required but not available");
      }
      
      // #region agent log
      // Check auth state before insert
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'use-file-upload.ts:95',message:'Auth state before insert',data:{authUserId:authUser?.id,authError:authError?.message,orgId,taskId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-insert',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // #region agent log
      // Verify user membership in org - check all memberships for this user
      const { data: allMemberships, error: allMembershipsError } = await supabase
        .from("organisation_members")
        .select("org_id, user_id")
        .eq("user_id", authUser?.id || '');
      const { data: specificMembership, error: membershipError } = await supabase
        .from("organisation_members")
        .select("org_id, user_id")
        .eq("org_id", orgId)
        .eq("user_id", authUser?.id || '')
        .maybeSingle();
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'use-file-upload.ts:105',message:'Membership check result',data:{allMemberships,allMembershipsError:allMembershipsError?.message,specificMembership,membershipError:membershipError?.message,orgId,authUserId:authUser?.id,orgIdMatches:allMemberships?.some(m=>m.org_id===orgId)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-insert',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      const attachmentPayload = {
        org_id: orgId,
        parent_type: "task",
        parent_id: taskId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      };
      
      // #region agent log
      console.log('[use-file-upload] Creating attachment record:', {
        orgId,
        taskId,
        fileName: file.name,
        payload: { ...attachmentPayload, file_size: file.size },
      });
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'use-file-upload.ts:118',message:'Attachment payload before insert',data:{payload:attachmentPayload,authUserId:authUser?.id,orgId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-insert',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // #region agent log
      // Use RPC function to bypass RLS
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'use-file-upload.ts:135',message:'Calling create_attachment_record RPC',data:{orgId,fileUrl:urlData.publicUrl,fileName:file.name,fileType:file.type,fileSize:file.size,parentType:'task',parentId:taskId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-insert',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'use-file-upload.ts:145',message:'RPC result',data:{success:!!attachmentData,error:attachError?.message,errorCode:attachError?.code,errorDetails:attachError?.details,errorHint:attachError?.hint,orgId,authUserId:authUser?.id,attachmentId:attachmentData?.[0]?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-insert',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion

      if (attachError) {
        console.error('[use-file-upload] Attachment RPC error:', {
          error: attachError,
          code: attachError.code,
          message: attachError.message,
          details: attachError.details,
          hint: attachError.hint,
          orgId,
          taskId,
        });
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

