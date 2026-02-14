import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export type AutomationMode = "conservative" | "recommended" | "aggressive";
export type AutomationAggressiveness = AutomationMode; // backwards compat

export type AutoTaskLevel = "critical" | "high" | "expiring_soon" | "upcoming";

export interface OrgSettings {
  org_id: string;
  auto_schedule_compliance: boolean;
  auto_task_creation?: boolean;
  auto_assignment?: boolean;
  automation_aggressiveness?: AutomationAggressiveness;
  updated_at: string;
  // Phase 10B: granular automation preferences
  automation_mode?: AutomationMode;
  auto_task_generation?: boolean;
  auto_task_levels?: AutoTaskLevel[] | null;
  auto_assign_contractors?: boolean;
  auto_assign_confidence?: number;
  auto_expiry_update?: boolean;
  auto_expiry_confidence?: number;
  auto_link_assets?: boolean;
  auto_link_asset_confidence?: number;
  auto_link_spaces?: boolean;
  auto_link_space_confidence?: number;
  // Phase 11: Filla Brain AI preferences
  automated_intelligence?: "off" | "suggestions_only" | "auto_draft" | "auto_create" | "full_automation";
  prediction_aggressiveness?: "conservative" | "recommended" | "aggressive";
  hazard_sensitivity?: "low" | "medium" | "high";
  data_sharing_level?: "minimal" | "standard" | "full_anonymised";
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
    mutationFn: async (payload: Partial<Omit<OrgSettings, "org_id" | "updated_at">>) => {
      const { org_id: _o, updated_at: _u, ...rest } = payload as OrgSettings;
      const { data, error } = await supabase
        .from("org_settings")
        .upsert(
          {
            org_id: orgId,
            ...rest,
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
