import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyPhoto {
  id: string;
  url: string;
  caption?: string;
  uploaded_at: string;
}

export const usePropertyPhotos = (propertyId: string) => {
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["property-photos", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_image_versions")
        .select("id, storage_path, thumbnail_path, annotation_summary, created_at")
        .eq("property_id", propertyId)
        .neq("is_archived", true)
        .order("version_number", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row): PropertyPhoto => ({
        id: row.id,
        url: row.thumbnail_path || row.storage_path,
        caption: row.annotation_summary ?? undefined,
        uploaded_at: row.created_at ?? new Date().toISOString(),
      }));
    },
    enabled: !!propertyId,
    staleTime: 60000,
  });

  return { photos, isLoading };
};
