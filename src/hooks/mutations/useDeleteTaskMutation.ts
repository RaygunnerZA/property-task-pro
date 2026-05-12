/**
 * Permanently deletes a task row.
 * Invalidates task list and property-timeline caches on success.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeleteTaskVariables {
  taskId: string;
  /** Used to invalidate property-scoped caches. */
  orgId?: string;
  propertyId?: string | null;
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId }: DeleteTaskVariables) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables.orgId) {
        void queryClient.invalidateQueries({
          queryKey: ["tasks-briefing", variables.orgId, null],
        });
        if (variables.propertyId) {
          void queryClient.invalidateQueries({
            queryKey: ["tasks-briefing", variables.orgId, variables.propertyId],
          });
          void queryClient.invalidateQueries({
            queryKey: ["property-timeline", variables.orgId, variables.propertyId],
          });
          void queryClient.invalidateQueries({
            queryKey: ["property-vendors", variables.orgId, variables.propertyId],
          });
        }
      }
    },
  });
}
