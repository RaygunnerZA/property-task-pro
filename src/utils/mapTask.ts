import type { Tables } from "../integrations/supabase/types";

export function mapTask(task: Tables<"tasks">) {
  return {
    id: task.id,
    title: task.title ?? "Untitled Task",
    status: task.status ?? "open",
    property_id: task.property_id ?? null,
    description: task.description ?? "",
    due_at: task.due_date ?? null, // Map due_date from DB to due_at for compatibility
    priority: task.priority ?? "medium",
    completed_at: task.completed_at ?? null,
    updated_at: task.updated_at ?? null
  };
}
