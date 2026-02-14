import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useSpaceDocumentsQuery(spaceId: string | undefined, propertyId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["space_documents", orgId, spaceId, propertyId],
    queryFn: async () => {
      if (!orgId || !spaceId || !propertyId) return [];

      const { data: links, error: linksError } = await supabase
        .from("attachment_spaces")
        .select("attachment_id")
        .eq("space_id", spaceId);
      if (linksError) throw linksError;
      if (!links?.length) return [];

      const attachmentIds = links.map((r) => r.attachment_id);
      const { data, error } = await supabase
        .from("attachments")
        .select(
          "id, file_url, file_name, file_type, thumbnail_url, title, category, document_type, expiry_date, status, metadata, updated_at"
        )
        .in("id", attachmentIds)
        .eq("org_id", orgId)
        .eq("parent_type", "property")
        .eq("parent_id", propertyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!spaceId && !!propertyId && !orgLoading,
    staleTime: 60000,
  });
}
