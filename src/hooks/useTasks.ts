import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";
import { useRealtime } from "./useRealtime";

type TaskRow = Tables<"tasks">;

export function useTasks(orgId?: string) {
  const supabase = useSupabase();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    setError(null);

    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

    if (orgId) query = query.eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setTasks(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, [orgId]);

  useRealtime("tasks", "tasks", fetchTasks);

  return { tasks, loading, error, refresh: fetchTasks };
}
