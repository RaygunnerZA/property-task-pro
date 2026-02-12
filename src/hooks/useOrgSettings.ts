import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface OrgSettings {
  org_id: string;
  auto_schedule_compliance: boolean;
  updated_at: string;
}

export function useOrgSettings() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["org_settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_settings")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as OrgSettings | null;
    },
    enabled: !!orgId && !orgLoading,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { auto_schedule_compliance?: boolean }) => {
      const { data, error } = await supabase
        .from("org_settings")
        .upsert(
          {
            org_id: orgId,
            ...payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_settings", orgId] });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading || orgLoading,
    error: query.error,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
