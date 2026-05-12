import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LabelRow, TaskLabelRow } from "@/types/database";
import { useActiveOrg } from "./useActiveOrg";

export function useLabels() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLabels() {
    if (!orgId) {
      setLabels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("labels")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (err) setError(err.message);
    else setLabels(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchLabels();
    }
  }, [orgId, orgLoading]);

  async function createLabel(name: string, color?: string, icon?: string) {
    if (!orgId) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("labels")
      .insert({ org_id: orgId, name, color, icon })
      .select()
      .single();

    if (err) {
      setError(err.message);
      return null;
    }

    await fetchLabels();
    return data;
  }

  async function deleteLabel(labelId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase as any)
      .from("labels")
      .delete()
      .eq("id", labelId);

    if (err) {
      setError(err.message);
      return false;
    }

    await fetchLabels();
    return true;
  }

  return { labels, loading, error, refresh: fetchLabels, createLabel, deleteLabel };
}

export function useTaskLabels(taskId?: string) {
  const { orgId } = useActiveOrg();
  const [taskLabels, setTaskLabels] = useState<TaskLabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTaskLabels() {
    if (!taskId) {
      setTaskLabels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("task_labels")
      .select("*")
      .eq("task_id", taskId);

    if (err) setError(err.message);
    else setTaskLabels(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchTaskLabels();
  }, [taskId]);

  async function addLabelToTask(labelId: string) {
    if (!taskId) return false;
    if (!orgId) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase as any)
      .from("task_labels")
      .insert({ task_id: taskId, label_id: labelId, org_id: orgId });

    if (err) {
      setError(err.message);
      return false;
    }

    await fetchTaskLabels();
    return true;
  }

  async function removeLabelFromTask(labelId: string) {
    if (!taskId) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase as any)
      .from("task_labels")
      .delete()
      .eq("task_id", taskId)
      .eq("label_id", labelId);

    if (err) {
      setError(err.message);
      return false;
    }

    await fetchTaskLabels();
    return true;
  }

  return { taskLabels, loading, error, refresh: fetchTaskLabels, addLabelToTask, removeLabelFromTask };
}
