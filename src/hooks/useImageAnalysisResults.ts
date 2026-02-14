/**
 * Fetch AI analysis results for task attachments
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export interface ImageAnalysisResult {
  id: string;
  attachment_id: string;
  org_id: string;
  ocr_text: string | null;
  detected_objects: Array<{
    type: string;
    label: string;
    confidence: number;
    serial_number?: string;
    expiry_date?: string;
    model?: string;
  }>;
  metadata: Record<string, unknown>;
}

export function useImageAnalysisResults(attachmentIds: string[]) {
  const { orgId } = useActiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["image-analysis-results", orgId, attachmentIds],
    queryFn: async () => {
      if (!orgId || attachmentIds.length === 0) return [];
      const { data: rows, error } = await supabase
        .from("image_analysis_results")
        .select("id, attachment_id, org_id, ocr_text, detected_objects, metadata")
        .eq("org_id", orgId)
        .in("attachment_id", attachmentIds);

      if (error) {
        console.warn("Failed to fetch image analysis:", error);
        return [];
      }
      return (rows || []) as ImageAnalysisResult[];
    },
    enabled: !!orgId && attachmentIds.length > 0,
    staleTime: 60000,
  });

  const byAttachmentId = new Map<string, ImageAnalysisResult>();
  for (const row of data || []) {
    byAttachmentId.set(row.attachment_id, row);
  }

  return {
    results: data || [],
    byAttachmentId,
    isLoading,
  };
}
