import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

export function useMemberIntakeEmail() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["member_intake_email", orgId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("get_member_intake_email", {
        p_org_id: orgId!,
      });
      if (error) throw error;
      if (!data) throw new Error("Address unavailable");
      return data;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });
}

export function useRotateMemberIntakeEmail() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!orgId) throw new Error("No organisation selected");
      const { data, error } = await supabase.rpc("rotate_member_intake_email", {
        p_org_id: orgId,
      });
      if (error) throw error;
      if (!data) throw new Error("Could not replace the address");
      return data;
    },
    onSuccess: (address) => {
      if (!orgId) return;
      queryClient.setQueryData(["member_intake_email", orgId], address);
    },
  });
}
