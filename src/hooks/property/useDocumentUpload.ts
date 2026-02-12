import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export interface AIDocAnalysisResult {
  title?: string;
  category?: string;
  document_type?: string;
  expiry_date?: string;
  /** Phase 5: No auto-linking. Suggestions stored in metadata only. */
}

export function useDocumentUpload(propertyId: string) {
  const { orgId } = useActiveOrg();
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  const upload = async (files: File[]) => {
    if (!orgId || !propertyId) return [];

    setUploading(true);
    const created: string[] = [];

    try {
      for (const file of files) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `org/${orgId}/properties/${propertyId}/documents/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("task-images")
          .getPublicUrl(path);

        const fileUrl = urlData.publicUrl;
        const title = file.name.replace(/\.[^/.]+$/, "") || "Untitled";

        const { data: ins, error: insError } = await supabase
          .from("attachments")
          .insert({
            org_id: orgId,
            parent_type: "property",
            parent_id: propertyId,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            title,
            category: null,
            document_type: null,
            expiry_date: null,
            renewal_frequency: null,
            status: null,
            notes: null,
          })
          .select("id")
          .single();

        if (insError) throw insError;
        if (ins?.id) created.push(ins.id);

        // Fire-and-forget: AI analysis runs async, updates attachment when done
        supabase.functions
          .invoke("ai-doc-analyse", {
            body: {
              file_url: fileUrl,
              file_name: file.name,
              property_id: propertyId,
              org_id: orgId,
              attachment_id: ins?.id,
            },
          })
          .then(() => {})
          .catch((err) => console.warn("AI doc analysis failed:", err));
      }

      return created;
    } finally {
      setUploading(false);
      setPreviews([]);
    }
  };

  const addPreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviews((p) => [...p, { file, url }]);
  };

  const clearPreviews = () => setPreviews([]);

  return {
    upload,
    uploading,
    previews,
    addPreview,
    clearPreviews,
  };
}
