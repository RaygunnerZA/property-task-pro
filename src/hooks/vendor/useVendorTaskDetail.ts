import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import type { VendorTask } from "./useVendorTasks";

function mapDbStatus(s: string | null): VendorTask["status"] {
  switch (s) {
    case "in_progress": return "In Progress";
    case "completed":
    case "archived": return "Completed";
    default: return "Assigned";
  }
}

function mapVendorStatusToDb(s: VendorTask["status"]): "open" | "in_progress" | "completed" {
  switch (s) {
    case "In Progress":
    case "Waiting Review": return "in_progress";
    case "Completed": return "completed";
    default: return "open";
  }
}

export const useVendorTaskDetail = (taskId: string) => {
  const { userId } = useDataContext();
  const queryClient = useQueryClient();

  const { data: task = null, isLoading } = useQuery({
    queryKey: ["vendor-task-detail", taskId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks_view")
        .select("id, title, description, status, priority, due_date, property_name")
        .eq("id", taskId)
        .eq("assigned_user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        title: data.title ?? "Untitled task",
        description: (data.description as string | null) ?? "",
        status: mapDbStatus(data.status),
        due_at: (data.due_date as string | null) ?? new Date().toISOString(),
        property_name: (data.property_name as string | null) ?? undefined,
        priority: data.priority ?? "normal",
      } satisfies VendorTask;
    },
    enabled: !!taskId && !!userId,
    staleTime: 30000,
  });

  const { mutate: updateStatusMutation } = useMutation({
    mutationFn: async (newStatus: VendorTask["status"]) => {
      const dbStatus = mapVendorStatusToDb(newStatus);
      const { error } = await supabase
        .from("tasks")
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-tasks"] });
    },
  });

  const updateStatus = (newStatus: VendorTask["status"]) => {
    updateStatusMutation(newStatus);
  };

  return { task, isLoading, updateStatus };
};
