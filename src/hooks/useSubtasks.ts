import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type SubtaskRow = Tables<"subtasks">;

interface CreateSubtaskOptions {
  is_yes_no?: boolean;
  requires_signature?: boolean;
  order_index?: number;
}

/**
 * Hook to fetch and manage subtasks for a task.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Mutations are handled via useMutation for create/update/delete operations.
 * 
 * @param taskId - The task ID to fetch subtasks for
 * @returns Subtasks array, loading state, error state, refresh function, and mutation functions
 */
export function useSubtasks(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching subtasks
  const { data: subtasks = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.subtasks(orgId ?? undefined, taskId),
    queryFn: async (): Promise<SubtaskRow[]> => {
      if (!taskId || !orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", taskId)
        .eq("org_id", orgId)
        .eq("is_archived", false)
        .order("order_index", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as SubtaskRow[]) ?? [];
    },
    enabled: !!orgId && !!taskId && !orgLoading, // Only fetch when we have orgId and taskId
    staleTime: 60 * 1000, // 1 minute - subtasks change moderately
    retry: 1,
  });

  // Mutation for creating a subtask
  const createSubtaskMutation = useMutation({
    mutationFn: async ({ title, options, currentLength }: { 
      title: string; 
      options?: CreateSubtaskOptions;
      currentLength: number;
    }) => {
      if (!taskId || !orgId) {
        throw new Error("Missing taskId or orgId");
      }

      const { data, error: err } = await supabase
        .from("subtasks")
        .insert({
          task_id: taskId,
          org_id: orgId,
          title,
          is_yes_no: options?.is_yes_no ?? false,
          requires_signature: options?.requires_signature ?? false,
          order_index: options?.order_index ?? currentLength,
          is_completed: false,
          completed: false,
        })
        .select()
        .single();

      if (err) {
        throw err;
      }

      return data as SubtaskRow;
    },
    onSuccess: () => {
      // Invalidate and refetch subtasks after creation
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(orgId ?? undefined, taskId) });
    },
  });

  // Mutation for toggling subtask completion
  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ subtaskId, currentCompleted }: { subtaskId: string; currentCompleted: boolean }) => {
      const { error: err } = await supabase
        .from("subtasks")
        .update({ 
          is_completed: !currentCompleted,
          completed: !currentCompleted,
        })
        .eq("id", subtaskId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch subtasks after toggle
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(orgId ?? undefined, taskId) });
    },
  });

  // Mutation for deleting (archiving) a subtask
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      const { error: err } = await supabase
        .from("subtasks")
        .update({ is_archived: true })
        .eq("id", subtaskId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch subtasks after deletion
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(orgId ?? undefined, taskId) });
    },
  });

  // Mutation for updating subtask order
  const updateSubtaskOrderMutation = useMutation({
    mutationFn: async (subtaskIds: string[]) => {
      const updates = subtaskIds.map((id, index) => ({
        id,
        order_index: index,
      }));

      // Update all subtasks in parallel
      const updatePromises = updates.map(update =>
        supabase
          .from("subtasks")
          .update({ order_index: update.order_index })
          .eq("id", update.id)
      );

      const results = await Promise.all(updatePromises);
      
      // Check for any errors
      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }
    },
    onSuccess: () => {
      // Invalidate and refetch subtasks after order update
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(orgId ?? undefined, taskId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation functions
  const createSubtask = async (title: string, options?: CreateSubtaskOptions) => {
    try {
      const data = await createSubtaskMutation.mutateAsync({ 
        title, 
        options, 
        currentLength: subtasks.length 
      });
      return data;
    } catch {
      return null;
    }
  };

  const toggleSubtask = async (subtaskId: string) => {
    const subtask = subtasks.find(s => s.id === subtaskId);
    if (!subtask) {
      return false;
    }

    try {
      await toggleSubtaskMutation.mutateAsync({ 
        subtaskId, 
        currentCompleted: subtask.is_completed || subtask.completed 
      });
      return true;
    } catch {
      return false;
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      await deleteSubtaskMutation.mutateAsync(subtaskId);
      return true;
    } catch {
      return false;
    }
  };

  const updateSubtaskOrder = async (subtaskIds: string[]) => {
    try {
      await updateSubtaskOrderMutation.mutateAsync(subtaskIds);
      return true;
    } catch {
      return false;
    }
  };

  return { 
    subtasks, 
    loading, 
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh, 
    createSubtask, 
    toggleSubtask, 
    deleteSubtask,
    updateSubtaskOrder,
  };
}
