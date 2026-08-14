import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { parseRepeatRule } from "@/lib/taskWhenNormalize";

export interface UseTasksQueryOptions {
  enabled?: boolean;
}

export function useTasksQuery(
  propertyId?: string,
  options?: UseTasksQueryOptions
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const enabled = options?.enabled !== false;

  return useQuery({
    queryKey: ["tasks", orgId, propertyId],
    queryFn: async () => {
      if (!orgId) {
        throw new Error("No orgId available");
      }

      let query = supabase
        .from("tasks_view")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const [{ data, error }, { data: recurrenceRows, error: recurrenceError }] =
        await Promise.all([
          query,
          supabase
            .from("task_recurrence")
            .select("task_id, rule")
            .eq("org_id", orgId),
        ]);

      if (error) throw error;
      if (recurrenceError) {
        console.warn("[useTasksQuery] Could not load task_recurrence:", recurrenceError.message);
      }

      const ruleByTaskId = new Map<string, unknown>();
      for (const row of recurrenceRows ?? []) {
        if (row?.task_id && parseRepeatRule(row.rule)) {
          ruleByTaskId.set(row.task_id, row.rule);
        }
      }

      // Images are already included in tasks_view as a JSON array
      // Extract primary_image_url from the first image in the array for backward compatibility
      const tasksWithImages = (data || []).map((task: any) => {
        let primary_image_url = null;

        // Parse images array if it's a string (from JSON aggregation)
        if (task.images) {
          try {
            const images = typeof task.images === "string" ? JSON.parse(task.images) : task.images;
            if (Array.isArray(images) && images.length > 0) {
              const firstImageAttachment = images.find((attachment: any) => {
                const fileType = String(attachment?.file_type || "").toLowerCase();
                const fileName = String(attachment?.file_name || "").toLowerCase();
                return (
                  fileType.startsWith("image/") ||
                  /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName)
                );
              });
              const fallbackAttachment = images[0];
              const preferredAttachment = firstImageAttachment || fallbackAttachment;
              primary_image_url =
                preferredAttachment?.thumbnail_url || preferredAttachment?.file_url || null;
            }
          } catch {
            // Skip invalid JSON
          }
        }

        const repeat_rule = ruleByTaskId.get(task.id) ?? null;

        return {
          ...task,
          primary_image_url,
          repeat_rule,
        };
      });

      return tasksWithImages;
    },
    enabled: enabled && !!orgId && !orgLoading, // Only fetch when orgId is available and not loading
    staleTime: 60000, // 1 minute
  });
}
