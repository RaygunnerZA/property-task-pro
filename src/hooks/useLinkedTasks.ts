import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedTask {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  /** Display alias for tasks.due_at */
  due_date: string | null;
}

export function useLinkedTasks(assetId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["linked-tasks", assetId],
    queryFn: async () => {
      if (!assetId || !orgId) return [];
      const { data: rows, error: err } = await supabase
        .from("task_assets")
        .select("task_id")
        .eq("asset_id", assetId);

      if (err) throw err;
      const taskIds = (rows ?? []).map((r) => r.task_id);
      if (taskIds.length === 0) return [];

      // Live schema uses due_at (not due_date).
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_at")
        .eq("org_id", orgId)
        .in("id", taskIds)
        .order("due_at", { ascending: true, nullsFirst: false });

      if (tasksErr) throw tasksErr;
      return (tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_at,
      })) as LinkedTask[];
    },
    enabled: !!assetId && !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    tasks: data ?? [],
    loading: isLoading || orgLoading,
    error: error ? (error as Error).message : null,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-tasks", assetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail", orgId, assetId] });
    },
  };
}
