import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/logger";

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
      // #region agent log
      console.log('[DEBUG] useTasksQuery result', {dataCount:data?.length||0,error:error?.message||null,orgId});
      debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'F',location:'useTasksQuery.ts:25',message:'Tasks query result',data:{dataCount:data?.length||0,error:error?.message||null,orgId,firstTask:data?.[0]||null},timestamp:Date.now()});
      // #endregion
      if (error) throw error;
      
      // Images are already included in tasks_view as a JSON array
      // Extract primary_image_url from the first image in the array for backward compatibility
      const tasksWithImages = (data || []).map((task: any) => {
        let primary_image_url = null;
        
        // Parse images array if it's a string (from JSON aggregation)
        if (task.images) {
          try {
            const images = typeof task.images === 'string' ? JSON.parse(task.images) : task.images;
            if (Array.isArray(images) && images.length > 0) {
              // Use the first image's thumbnail_url or file_url
              primary_image_url = images[0].thumbnail_url || images[0].file_url || null;
            }
          } catch {
            // Skip invalid JSON
          }
        }
        
        return {
          ...task,
          primary_image_url,
        };
      });
      
      return tasksWithImages;
    },
    enabled: !!orgId && !orgLoading, // Only fetch when orgId is available and not loading
    staleTime: 60000, // 1 minute
  });
}
