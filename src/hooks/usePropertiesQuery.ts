import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function usePropertiesQuery() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["properties", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties_view")
        .select("*")
        .eq("org_id", orgId);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000, // 1 minute
  });
}

