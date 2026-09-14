import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { trackKnowledgeReused } from "@/lib/knowledge/knowledgeTelemetry";
import {
  pickTopSeasonalPackage,
  type SeasonalPackage,
  type SeasonalSoftSignal,
} from "@/types/seasonalPackage";

export function useActiveSeasonalPackages(options?: {
  softSignals?: SeasonalSoftSignal;
  enabled?: boolean;
}) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const enabled = (options?.enabled ?? true) && Boolean(orgId) && !orgLoading;
  const softSignals = options?.softSignals;

  const query = useQuery({
    queryKey: ["seasonal-packages", orgId],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SeasonalPackage[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("list_active_seasonal_packages", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as SeasonalPackage[];
    },
  });

  const topPackage = pickTopSeasonalPackage(query.data ?? [], softSignals);

  return {
    ...query,
    packages: query.data ?? [],
    topPackage,
  };
}

export function useDismissSeasonalPackage() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packageId: string) => {
      if (!orgId) throw new Error("No active organisation");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("dismiss_seasonal_package", {
        p_org_id: orgId,
        p_package_id: packageId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seasonal-packages", orgId] });
    },
  });
}

export function useMarkSeasonalPackageCta() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      packageId: string;
      itemId: string;
      knowledgeId: string;
    }) => {
      if (!orgId) throw new Error("No active organisation");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("mark_seasonal_package_cta", {
        p_org_id: orgId,
        p_package_id: input.packageId,
        p_item_id: input.itemId,
      });
      if (error) throw error;
      trackKnowledgeReused({
        org_id: orgId,
        knowledge_id: input.knowledgeId,
        via: "page",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seasonal-packages", orgId] });
    },
  });
}
