import { useQuery } from "@tanstack/react-query";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

export interface VendorTask {
  id: string;
  title: string;
  description: string;
  status: "Assigned" | "In Progress" | "Completed" | "Waiting Review";
  due_at: string;
  property_name?: string;
  priority: string;
}

function mapDbStatus(s: string | null): VendorTask["status"] {
  switch (s) {
    case "in_progress": return "In Progress";
    case "completed":
    case "archived": return "Completed";
    default: return "Assigned";
  }
}

export const useVendorTasks = () => {
  const { userId } = useDataContext();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["vendor-tasks", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks_view")
        .select("id, title, description, status, priority, due_date, property_name")
        .eq("assigned_user_id", userId!)
        .not("status", "eq", "archived")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data ?? []).map((row): VendorTask => ({
        id: row.id,
        title: row.title ?? "Untitled task",
        description: (row.description as string | null) ?? "",
        status: mapDbStatus(row.status),
        due_at: (row.due_date as string | null) ?? new Date().toISOString(),
        property_name: (row.property_name as string | null) ?? undefined,
        priority: row.priority ?? "normal",
      }));
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  const stats = {
    assigned: tasks.filter((t) => t.status === "Assigned").length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    completed: tasks.filter((t) => t.status === "Completed").length,
  };

  return { tasks, isLoading, stats };
};
