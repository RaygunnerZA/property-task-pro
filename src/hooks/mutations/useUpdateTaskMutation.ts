/**
 * Updates core task fields (title, status, priority, due_date, milestones).
 * Invalidates task list and briefing caches on success.
 * Per @Docs/24_Phase1_Observability_Spec — no analytics event for task updates (read/write ratio too high).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Tables"]["tasks"]["Row"]["priority"];

/** Remote `tasks` table uses `due_at`; reads expose `due_date` via `tasks_view`. */
function mapUpdatesToTasksTable(updates: UpdateTaskVariables["updates"]): Record<string, unknown> {
  const { due_date, ...rest } = updates;
  const payload: Record<string, unknown> = { ...rest };
  if (due_date !== undefined) {
    payload.due_at = due_date;
  }
  return payload;
}

export interface UpdateTaskVariables {
  taskId: string;
  orgId: string;
  propertyId?: string | null;
  updates: {
    title?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    due_date?: string | null;
    milestones?: string[];
  };
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, updates }: UpdateTaskVariables) => {
      const tableUpdates = mapUpdatesToTasksTable(updates);
      const { data, error } = await supabase
        .from("tasks")
        .update(tableUpdates)
        .eq("id", taskId)
        .select("id, org_id, property_id, status")
        .single();
      if (error) throw error;
      if (!data) throw new Error("useUpdateTaskMutation: no data returned");
      return data;
    },
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      if (data.org_id) {
        void queryClient.invalidateQueries({
          queryKey: ["tasks-briefing", data.org_id, null],
        });
        if (data.property_id) {
          void queryClient.invalidateQueries({
            queryKey: ["tasks-briefing", data.org_id, data.property_id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["property-timeline", data.org_id, data.property_id],
          });
          if (data.status === "completed") {
            void queryClient.invalidateQueries({
              queryKey: ["property-vendors", data.org_id, data.property_id],
            });
            void queryClient.invalidateQueries({
              queryKey: ["property-drift", data.org_id, data.property_id],
            });
          }
        }
      }
    },
  });
}
