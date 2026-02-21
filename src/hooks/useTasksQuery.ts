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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7a02c2'},body:JSON.stringify({sessionId:'7a02c2',location:'useTasksQuery.ts:queryFn',message:'H-A/H-E: tasks queryFn executing',data:{orgId,propertyId,ts:new Date().toISOString()},timestamp:Date.now(),hypothesisId:'H-A_H-E'})}).catch(()=>{});
      // #endregion

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
      
      // #region agent log
      const sample = tasksWithImages[0];
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7a02c2'},body:JSON.stringify({sessionId:'7a02c2',location:'useTasksQuery.ts:queryFn',message:'H-E: tasks queryFn returned data',data:{count:tasksWithImages.length,firstTask:sample?{id:sample.id,title:sample.title,status:sample.status,priority:sample.priority,due_date:sample.due_date}:null},timestamp:Date.now(),hypothesisId:'H-E'})}).catch(()=>{});
      // #endregion

      return tasksWithImages;
    },
    enabled: !!orgId && !orgLoading, // Only fetch when orgId is available and not loading
    staleTime: 60000, // 1 minute
  });
}
