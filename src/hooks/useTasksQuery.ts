import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useTasksQuery(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

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

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch primary images for all tasks from attachments table
      const taskIds = (data || []).map((t: any) => t.id);
      
      if (taskIds.length > 0 && orgId) {
        const { data: imagesData, error: imagesError } = await supabase
          .from("attachments")
          .select("parent_id, file_url, thumbnail_url, parent_type, org_id")
          .eq("parent_type", "task")
          .in("parent_id", taskIds)
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (imagesError) {
          console.error("Error fetching task images:", imagesError);
        }

        // Create a map of task_id -> primary image_url (prefer thumbnail)
        const imageMap = new Map<string, string>();
        if (imagesData) {
          imagesData.forEach((img: any) => {
            if (!imageMap.has(img.parent_id)) {
              imageMap.set(img.parent_id, img.thumbnail_url || img.file_url);
            }
          });
        }

        // Add primary_image_url to each task
        const tasksWithImages = (data || []).map((task: any) => ({
          ...task,
          primary_image_url: imageMap.get(task.id) || null,
        }));
        
        return tasksWithImages;
      }

      return data ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when orgId is available and not loading
    staleTime: 60000, // 1 minute
  });
}
