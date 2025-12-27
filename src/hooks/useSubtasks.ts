import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type SubtaskRow = Tables<"subtasks">;

export function useSubtasks(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchSubtasks() {
    if (!taskId || !orgId) {
      setSubtasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .eq("org_id", orgId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true });

    if (err) setError(err.message);
    else setSubtasks(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchSubtasks();
    }
  }, [taskId, orgId, orgLoading]);

  async function createSubtask(title: string, options?: {
    is_yes_no?: boolean;
    requires_signature?: boolean;
    order_index?: number;
  }) {
    if (!taskId || !orgId) return null;

    const { data, error: err } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        org_id: orgId,
        title,
        is_yes_no: options?.is_yes_no ?? false,
        requires_signature: options?.requires_signature ?? false,
        order_index: options?.order_index ?? subtasks.length,
        is_completed: false,
        completed: false,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      return null;
    }

    await fetchSubtasks();
    return data;
  }

  async function toggleSubtask(subtaskId: string) {
    const subtask = subtasks.find(s => s.id === subtaskId);
    if (!subtask) return false;

    const { error: err } = await supabase
      .from("subtasks")
      .update({ 
        is_completed: !subtask.is_completed,
        completed: !subtask.completed,
      })
      .eq("id", subtaskId);

    if (err) {
      setError(err.message);
      return false;
    }

    await fetchSubtasks();
    return true;
  }

  async function deleteSubtask(subtaskId: string) {
    const { error: err } = await supabase
      .from("subtasks")
      .update({ is_archived: true })
      .eq("id", subtaskId);

    if (err) {
      setError(err.message);
      return false;
    }

    await fetchSubtasks();
    return true;
  }

  async function updateSubtaskOrder(subtaskIds: string[]) {
    const updates = subtaskIds.map((id, index) => ({
      id,
      order_index: index,
    }));

    for (const update of updates) {
      const { error: err } = await supabase
        .from("subtasks")
        .update({ order_index: update.order_index })
        .eq("id", update.id);

      if (err) {
        setError(err.message);
        return false;
      }
    }

    await fetchSubtasks();
    return true;
  }

  return { 
    subtasks, 
    loading, 
    error, 
    refresh: fetchSubtasks, 
    createSubtask, 
    toggleSubtask, 
    deleteSubtask,
    updateSubtaskOrder,
  };
}
