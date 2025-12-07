import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useRealtime } from "./useRealtime";
import { useDataContext } from "@/contexts/DataContext";

type TaskRow = Tables<"tasks">;

export function useTasks() {
  const { orgId } = useDataContext();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    if (!orgId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

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
