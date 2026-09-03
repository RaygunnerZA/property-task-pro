import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AiRouteOverrideRow =
  Database["public"]["Functions"]["admin_list_ai_route_overrides"]["Returns"][number];
export type PlanExtractionMetricRow =
  Database["public"]["Functions"]["admin_ai_plan_extraction_metrics"]["Returns"][number];
export type ResolutionMetricRow =
  Database["public"]["Functions"]["admin_ai_resolution_metrics"]["Returns"][number];

const OVERRIDES_KEY = ["admin-ai-route-overrides"] as const;
const PLAN_METRICS_KEY = ["admin-ai-plan-extraction-metrics"] as const;
const RESOLUTION_METRICS_KEY = ["admin-ai-resolution-metrics"] as const;

export function useAdminAiRouteOverrides() {
  return useQuery({
    queryKey: OVERRIDES_KEY,
    queryFn: async (): Promise<AiRouteOverrideRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_ai_route_overrides");
      if (error) throw error;
      return (data ?? []) as AiRouteOverrideRow[];
    },
    staleTime: 30_000,
  });
}

export function useAdminAiPlanExtractionMetrics() {
  return useQuery({
    queryKey: PLAN_METRICS_KEY,
    queryFn: async (): Promise<PlanExtractionMetricRow[]> => {
      const { data, error } = await supabase.rpc("admin_ai_plan_extraction_metrics");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useAdminAiResolutionMetrics() {
  return useQuery({
    queryKey: RESOLUTION_METRICS_KEY,
    queryFn: async (): Promise<ResolutionMetricRow[]> => {
      const { data, error } = await supabase.rpc("admin_ai_resolution_metrics");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useSetAiRouteOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      capability: string;
      strategy: string;
      reason: string;
      expiresAt: string;
    }) => {
      const { error } = await supabase.rpc("set_ai_route_override", {
        p_capability: params.capability,
        p_strategy: params.strategy,
        p_reason: params.reason,
        p_expires_at: params.expiresAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OVERRIDES_KEY });
    },
  });
}

export function useClearAiRouteOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (capability: string) => {
      const { error } = await supabase.rpc("clear_ai_route_override", {
        p_capability: capability,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OVERRIDES_KEY });
    },
  });
}
