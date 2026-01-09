import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { useRealtime } from "./useRealtime";
import type { Tables } from "../integrations/supabase/types";

type TaskRow = Tables<"tasks">;

export function useTasks() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!orgId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("tasks")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (err) {
        setError(err.message);
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchTasks();
    }
  }, [fetchTasks, orgLoading]);

  // Subscribe to realtime changes for automatic updates
  useRealtime("tasks", "tasks", fetchTasks);

  return { tasks, loading, error, refresh: fetchTasks };
}

