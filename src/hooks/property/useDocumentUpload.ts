import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export interface AIDocAnalysisResult {
  title?: string;
  category?: string;
  document_type?: string;
  expiry_date?: string;
  suggested_links?: {
    spaces?: string[];
    assets?: string[];
    contractors?: string[];
    compliance?: string[];
  };
}

export function useDocumentUpload(propertyId: string) {
  const { orgId } = useActiveOrg();
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  const callAIAnalysis = async (
    fileUrl: string,
    fileName: string
  ): Promise<AIDocAnalysisResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-doc-analyse", {
        body: {
          file_url: fileUrl,
          file_name: fileName,
          property_id: propertyId,
          org_id: orgId,
        },
      });
      if (error) {
        console.warn("AI doc analysis failed:", error);
        return null;
      }
      return data as AIDocAnalysisResult;
    } catch {
      return null;
    }
  };

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

        let metadata: AIDocAnalysisResult | null = null;
        try {
          metadata = await callAIAnalysis(fileUrl, file.name);
        } catch {
          // non-fatal
        }

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
            title: metadata?.title || file.name.replace(/\.[^/.]+$/, ""),
            category: metadata?.category || null,
            document_type: metadata?.document_type || null,
            expiry_date: metadata?.expiry_date || null,
            renewal_frequency: null,
            status: null,
            notes: null,
          })
          .select("id")
          .single();

        if (insError) throw insError;
        if (ins?.id) created.push(ins.id);

        if (metadata?.suggested_links) {
          const attId = ins?.id;
          if (attId && metadata.suggested_links.spaces?.length) {
            await supabase.from("attachment_spaces").insert(
              metadata.suggested_links.spaces.map((space_id) => ({
                attachment_id: attId,
                space_id,
                org_id: orgId,
              }))
            );
          }
          if (attId && metadata.suggested_links.assets?.length) {
            await supabase.from("attachment_assets").insert(
              metadata.suggested_links.assets.map((asset_id) => ({
                attachment_id: attId,
                asset_id,
                org_id: orgId,
              }))
            );
          }
          if (attId && metadata.suggested_links.contractors?.length) {
            await supabase.from("attachment_contractors").insert(
              metadata.suggested_links.contractors.map((contractor_org_id) => ({
                attachment_id: attId,
                contractor_org_id,
                org_id: orgId,
              }))
            );
          }
          if (attId && metadata.suggested_links.compliance?.length) {
            await supabase.from("attachment_compliance").insert(
              metadata.suggested_links.compliance.map((compliance_document_id) => ({
                attachment_id: attId,
                compliance_document_id,
                org_id: orgId,
              }))
            );
          }
        }
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
