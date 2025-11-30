import type { Tables } from "../integrations/supabase/types";

export function mapTask(task: Tables<"tasks">) {
  return {
    id: task.id,
    title: task.title ?? "Untitled Task",
    status: task.status ?? "open",
    property_id: task.property_id ?? null,
    description: task.description ?? "",
    due_at: task.due_at ?? null,
    priority: task.priority ?? "medium",
    completed_at: task.completed_at ?? null,
    updated_at: task.updated_at ?? null
  };
}
