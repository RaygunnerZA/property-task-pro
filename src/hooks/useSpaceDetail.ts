import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useSpaceDetail(spaceId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["space", orgId, spaceId],
    queryFn: async () => {
      const { data: spaceData, error } = await supabase
        .from("spaces")
        .select("*")
        .eq("id", spaceId)
        .eq("org_id", orgId)
        .single();
      if (error) throw error;
      if (!spaceData?.property_id) return spaceData;
      const { data: prop } = await supabase
        .from("properties")
        .select("id, nickname, address")
        .eq("id", spaceData.property_id)
        .single();
      return { ...spaceData, properties: prop };
    },
    enabled: !!orgId && !!spaceId && !orgLoading,
    staleTime: 60000,
  });
}
