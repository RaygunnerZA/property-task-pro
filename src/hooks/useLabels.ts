import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type LabelRow = Tables<"labels">;

/**
 * Hook to fetch labels for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * Mutations are handled via useMutation for create/delete operations.
 * 
 * @returns Labels array, loading state, error state, refresh function, and mutation functions
 */
export function useLabels() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching labels
  const { data: labels = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.labels(orgId ?? undefined),
    queryFn: async (): Promise<LabelRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("labels")
        .select("*")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as LabelRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 5 * 60 * 1000, // 5 minutes - labels change infrequently
    retry: 1,
  });

  // Mutation for creating a label
  const createLabelMutation = useMutation({
    mutationFn: async ({ name, color, icon }: { name: string; color?: string; icon?: string }) => {
      if (!orgId) {
        throw new Error("No active organization");
      }

      const { data, error: err } = await supabase
        .from("labels")
        .insert({ org_id: orgId, name, color, icon })
        .select()
        .single();

      if (err) {
        throw err;
      }

      return data as LabelRow;
    },
    onSuccess: () => {
      // Invalidate and refetch labels after creation
      queryClient.invalidateQueries({ queryKey: queryKeys.labels(orgId ?? undefined) });
    },
  });

  // Mutation for deleting a label
  const deleteLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const { error: err } = await supabase
        .from("labels")
        .delete()
        .eq("id", labelId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch labels after deletion
      queryClient.invalidateQueries({ queryKey: queryKeys.labels(orgId ?? undefined) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation functions
  const createLabel = async (name: string, color?: string, icon?: string) => {
    try {
      const data = await createLabelMutation.mutateAsync({ name, color, icon });
      return data;
    } catch (err: any) {
      return null;
    }
  };

  const deleteLabel = async (labelId: string) => {
    try {
      await deleteLabelMutation.mutateAsync(labelId);
      return true;
    } catch {
      return false;
    }
  };

  return {
    labels,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    createLabel,
    deleteLabel,
  };
}

/**
 * Hook to fetch task labels for a specific task.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * Mutations are handled via useMutation for add/remove operations.
 * 
 * @param taskId - The task ID to fetch labels for
 * @returns Task labels array, loading state, error state, refresh function, and mutation functions
 */
export function useTaskLabels(taskId?: string) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  // Query for fetching task labels
  const { data: taskLabels = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.taskLabels(taskId),
    queryFn: async (): Promise<Tables<"task_labels">[]> => {
      if (!taskId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("task_labels")
        .select("*")
        .eq("task_id", taskId);

      if (err) {
        throw err;
      }

      return (data as Tables<"task_labels">[]) ?? [];
    },
    enabled: !!taskId, // Only fetch when we have taskId
    staleTime: 2 * 60 * 1000, // 2 minutes - task labels change moderately
    retry: 1,
  });

  // Mutation for adding a label to a task
  const addLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      if (!taskId || !orgId) {
        throw new Error("Missing taskId or orgId");
      }

      const { error: err } = await supabase
        .from("task_labels")
        .insert({ task_id: taskId, label_id: labelId, org_id: orgId });

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch task labels after adding
      queryClient.invalidateQueries({ queryKey: queryKeys.taskLabels(taskId) });
    },
  });

  // Mutation for removing a label from a task
  const removeLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      if (!taskId) {
        throw new Error("Missing taskId");
      }

      const { error: err } = await supabase
        .from("task_labels")
        .delete()
        .eq("task_id", taskId)
        .eq("label_id", labelId);

      if (err) {
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch task labels after removing
      queryClient.invalidateQueries({ queryKey: queryKeys.taskLabels(taskId) });
    },
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  // Backward-compatible mutation functions
  const addLabelToTask = async (labelId: string) => {
    try {
      await addLabelMutation.mutateAsync(labelId);
      return true;
    } catch {
      return false;
    }
  };

  const removeLabelFromTask = async (labelId: string) => {
    try {
      await removeLabelMutation.mutateAsync(labelId);
      return true;
    } catch {
      return false;
    }
  };

  return {
    taskLabels,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
    addLabelToTask,
    removeLabelFromTask,
  };
}
