import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

export function useOrgIntakeEmail() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["org_intake_email", orgId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("get_org_intake_email", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });
}
