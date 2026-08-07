import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type TaskCreatedSource = "manual" | "ai" | "assistant";

export interface CreateTaskMutationVariables {
  source: TaskCreatedSource;
  insert: TablesInsert<"tasks">;
}

type TaskRow = Tables<"tasks">;
type BriefingEntry = {
  id: string;
  status: string;
  property_id?: string;
  priority?: string;
  due_date?: string | null;
};

function patchBriefingCache(
  queryClient: ReturnType<typeof useQueryClient>,
  data: TaskRow
) {
  const orgId = data.org_id;
  const taskId = data.id;
  const propId = data.property_id ?? undefined;
  const entry: BriefingEntry = {
    id: taskId,
    status: data.status ?? "open",
    property_id: propId,
    priority: data.priority ?? "normal",
    due_date: data.due_at ?? null,
  };
  queryClient.setQueryData(["tasks-briefing", orgId, null], (old: BriefingEntry[] | undefined) =>
    [...(Array.isArray(old) ? old : []), entry]
  );
  if (propId) {
    queryClient.setQueryData(["tasks-briefing", orgId, propId], (old: BriefingEntry[] | undefined) =>
      [...(Array.isArray(old) ? old : []), entry]
    );
  }
}

/**
 * Inserts a `tasks` row, then fires `task_created` analytics and refreshes list caches.
 * Per @Docs/24_Phase1_Observability_Spec — do not call `track("task_created")` from UI components.
 */
export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  const { canCreateTask } = useEffectiveAccess();

  return useMutation({
    mutationFn: async ({ insert }: CreateTaskMutationVariables) => {
      if (!canCreateTask) {
        throw new Error(
          "Your role can complete assigned work and report issues, but cannot create tasks. Ask an Owner or Manager."
        );
      }
      let payload = { ...insert };
      if (!payload.owner_user_id) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          payload = { ...payload, owner_user_id: user.id };
        }
      }
      const { data, error } = await supabase.from("tasks").insert(payload).select().single();
      if (error) throw error;
      if (!data) throw new Error("Couldn't create task: no data returned");
      return data as TaskRow;
    },
    onSuccess: (data, variables) => {
      track("task_created", {
        org_id: data.org_id,
        task_id: data.id,
        source: variables.source,
      });
      patchBriefingCache(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      if (data.property_id) {
        void queryClient.invalidateQueries({
          queryKey: ["property-timeline", data.org_id, data.property_id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["property-vendors", data.org_id, data.property_id],
        });
      }
    },
  });
}
