import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useRealtime } from "./useRealtime";
import { useDataContext } from "@/contexts/DataContext";

type TaskRow = Tables<"tasks">;
type TaskImageRow = Tables<"task_images">;

export type TaskWithImage = TaskRow & {
  primary_image_url?: string | null;
};

export function useTasks() {
  const { orgId } = useDataContext();
  const [tasks, setTasks] = useState<TaskWithImage[]>([]);
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

    // Fetch tasks
    const { data: taskData, error: taskErr } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskErr) {
      setError(taskErr.message);
      setLoading(false);
      return;
    }

    // Fetch primary images for all tasks
    const taskIds = taskData?.map(t => t.id) || [];
    let imageMap = new Map<string, string>();

    if (taskIds.length > 0) {
      const { data: imageData } = await supabase
        .from("task_images")
        .select("task_id, image_url")
        .in("task_id", taskIds)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      // Map first image per task
      imageData?.forEach((img) => {
        if (img.task_id && img.image_url && !imageMap.has(img.task_id)) {
          imageMap.set(img.task_id, img.image_url);
        }
      });
    }

    // Combine tasks with their primary image
    const tasksWithImages: TaskWithImage[] = (taskData || []).map((task) => ({
      ...task,
      primary_image_url: imageMap.get(task.id) || null,
    }));

    setTasks(tasksWithImages);
    setLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, [orgId]);

  useRealtime("tasks", "tasks", fetchTasks);

  return { tasks, loading, error, refresh: fetchTasks };
}
