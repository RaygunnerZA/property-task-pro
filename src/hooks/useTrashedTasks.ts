import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { isTaskTrashExpired } from "@/lib/taskTrash";
import { deleteTask } from "@/services/tasks/taskMutations";

export type TrashedTaskRow = {
  id: string;
  title: string;
  updated_at: string;
  property_id: string | null;
  status: string;
};

/**
 * Archived tasks for the active org (Trash). Purges rows past the 30-day window.
 */
export function useTrashedTasks() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["trashed-tasks", orgId],
    enabled: Boolean(orgId) && !orgLoading,
    queryFn: async (): Promise<TrashedTaskRow[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, updated_at, property_id, status")
        .eq("org_id", orgId)
        .eq("status", "archived")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as TrashedTaskRow[];
      const expired = rows.filter((row) => isTaskTrashExpired(row.updated_at));
      if (expired.length > 0) {
        await Promise.allSettled(expired.map((row) => deleteTask(row.id, orgId)));
      }

      return rows.filter((row) => !isTaskTrashExpired(row.updated_at));
    },
  });
}
