import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgAutoTasksStats {
  today: number;
  week: number;
  month: number;
  overdueWithoutTask: number;
}

export function useOrgAutoTasksStats(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org_auto_tasks_stats", orgId],
    queryFn: async (): Promise<OrgAutoTasksStats> => {
      if (!orgId) return { today: 0, week: 0, month: 0, overdueWithoutTask: 0 };

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: autoTasks } = await supabase
        .from("compliance_auto_tasks")
        .select("id, created_at, status")
        .eq("org_id", orgId)
        .eq("status", "created");

      const tasks = autoTasks || [];
      const today = tasks.filter((t) => t.created_at >= todayStart).length;
      const week = tasks.filter((t) => t.created_at >= weekStart).length;
      const month = tasks.filter((t) => t.created_at >= monthStart).length;

      const todayStr = now.toISOString().split("T")[0];
      const { data: expiredByExpiry } = await supabase
        .from("compliance_documents")
        .select("id")
        .eq("org_id", orgId)
        .not("property_id", "is", null)
        .lt("expiry_date", todayStr);
      const { data: expiredByNext } = await supabase
        .from("compliance_documents")
        .select("id")
        .eq("org_id", orgId)
        .not("property_id", "is", null)
        .not("next_due_date", "is", null)
        .lt("next_due_date", todayStr);
      const overdueIds = new Set([
        ...(expiredByExpiry || []).map((d) => d.id),
        ...(expiredByNext || []).map((d) => d.id),
      ]);

      const { data: autoTaskDocIds } = await supabase
        .from("compliance_auto_tasks")
        .select("compliance_document_id")
        .eq("org_id", orgId)
        .in("status", ["created", "completed"]);

      const hasAutoTask = new Set((autoTaskDocIds || []).map((r) => r.compliance_document_id));
      const overdueWithoutTask = [...overdueIds].filter((id) => !hasAutoTask.has(id)).length;

      return { today, week, month, overdueWithoutTask };
    },
    enabled: !!orgId,
  });
}
