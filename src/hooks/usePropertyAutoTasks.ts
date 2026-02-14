import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyAutoTask {
  id: string;
  compliance_document_id: string;
  task_id: string | null;
  auto_task_type: string;
  status: string;
  created_at: string;
  doc_title?: string | null;
}

export function usePropertyAutoTasks(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property_auto_tasks", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data: docs } = await supabase
        .from("compliance_documents")
        .select("id, title")
        .eq("property_id", propertyId);
      const docIds = (docs || []).map((d) => d.id);
      if (docIds.length === 0) return [];

      const docTitles = new Map<string, string>();
      for (const d of docs || []) {
        docTitles.set(d.id, (d as any).title || "");
      }

      const { data, error } = await supabase
        .from("compliance_auto_tasks")
        .select("id, compliance_document_id, task_id, auto_task_type, status, created_at")
        .in("compliance_document_id", docIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        compliance_document_id: row.compliance_document_id,
        task_id: row.task_id,
        auto_task_type: row.auto_task_type,
        status: row.status,
        created_at: row.created_at,
        doc_title: docTitles.get(row.compliance_document_id) ?? null,
      })) as PropertyAutoTask[];
    },
    enabled: !!propertyId,
  });
}
