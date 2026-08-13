/**
 * Moves a task to Trash (status `archived`) via archive_task RPC.
 * Recoverable for TASK_TRASH_RETENTION_DAYS; permanent purge is handled from Trash.
 * Invalidates task list and property-timeline caches on success.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveTask } from "@/services/tasks/taskMutations";

export interface DeleteTaskVariables {
  taskId: string;
  /** Required to archive under org membership checks. */
  orgId?: string;
  propertyId?: string | null;
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, orgId }: DeleteTaskVariables) => {
      if (!orgId) {
        throw new Error("Organisation is required to move a task to Trash.");
      }
      await archiveTask(taskId, orgId);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["trashed-tasks"] });
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
