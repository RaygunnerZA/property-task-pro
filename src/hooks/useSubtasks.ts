import { useEffect, useState } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { SubtaskRow } from "@/types/database";
import { useActiveOrg } from "./useActiveOrg";

// subtasks is a pending-migration table — cast until schema is generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export function useSubtasks(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchSubtasks(options?: { silent?: boolean }) {
    if (!taskId || !orgId) {
      setSubtasks([]);
      setLoading(false);
      return;
    }

    // Never flip loading on background refreshes — that remounts the checklist
    // mid-keystroke and drops focus / caret.
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    const { data, error: err } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .eq("org_id", orgId)
      .or("is_archived.eq.false,is_archived.is.null")
      .order("order_index", { ascending: true });

    if (err) setError(err.message);
    else setSubtasks(data ?? []);

    if (!options?.silent) {
      setLoading(false);
    }
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
    step_type?: string;
    is_sub_step?: boolean;
    is_required?: boolean;
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
        step_type: options?.step_type ?? "check",
        is_sub_step: options?.is_sub_step ?? false,
        is_required: options?.is_required ?? false,
        order_index: options?.order_index ?? subtasks.length,
        is_completed: false,
        completed: false,
        is_archived: false,
      })
      .select()
      .single();

    if (err) {
      console.error("[useSubtasks] createSubtask failed:", err.message, err);
      setError(err.message);
      return null;
    }

    await fetchSubtasks({ silent: true });
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

    await fetchSubtasks({ silent: true });
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

    await fetchSubtasks({ silent: true });
    return true;
  }

  async function updateSubtask(
    subtaskId: string,
    updates: {
      title?: string;
      is_yes_no?: boolean;
      requires_signature?: boolean;
      order_index?: number;
      step_type?: string;
      is_sub_step?: boolean;
      is_required?: boolean;
    },
    options?: { refresh?: boolean }
  ) {
    const { error: err } = await supabase
      .from("subtasks")
      .update(updates)
      .eq("id", subtaskId);

    if (err) {
      setError(err.message);
      return false;
    }

    // Title-only persists skip refresh so typing stays local and focused.
    // Do not patch `subtasks` here — that re-syncs editorItems and can fight the caret.
    if (options?.refresh === false) {
      return true;
    }

    await fetchSubtasks({ silent: true });
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

    await fetchSubtasks({ silent: true });
    return true;
  }

  return { 
    subtasks, 
    loading, 
    error, 
    refresh: () => fetchSubtasks({ silent: true }), 
    createSubtask, 
    toggleSubtask, 
    deleteSubtask,
    updateSubtask,
    updateSubtaskOrder,
  };
}
