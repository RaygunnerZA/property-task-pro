import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useAssetsQuery(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["assets", orgId, propertyId],
    queryFn: async () => {
      let query = supabase
        .from("assets_view")
        .select("*")
        .eq("org_id", orgId);

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000, // 1 minute
  });
}

