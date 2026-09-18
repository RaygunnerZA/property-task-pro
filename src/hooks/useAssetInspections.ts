import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "@/integrations/supabase/types";

export type AssetInspectionRow = Tables<"asset_inspections">;

/**
 * Live does not expose `asset_inspections` yet
 * (@Docs/Schema_Discrepancy_Register.md — not on live).
 * Keep the hook API so the panel can render empty inspection history
 * without issuing a 404 REST call.
 */
export const ASSET_INSPECTIONS_AVAILABLE = false;

/**
 * Inspection history for an asset.
 * When the relation is not on live, returns [] without querying PostgREST.
 */
export function useAssetInspections(assetId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-inspections", assetId, ASSET_INSPECTIONS_AVAILABLE],
    queryFn: async () => {
      if (!ASSET_INSPECTIONS_AVAILABLE) return [] as AssetInspectionRow[];
      // Unreachable until ASSET_INSPECTIONS_AVAILABLE is flipped after a forward migration.
      const { supabase } = await import("@/integrations/supabase/client");
      if (!assetId) return [];
      const { data: rows, error: err } = await supabase
        .from("asset_inspections")
        .select("*")
        .eq("asset_id", assetId)
        .order("inspection_date", { ascending: false });
      if (err) throw err;
      return (rows ?? []) as AssetInspectionRow[];
    },
    enabled: !!assetId && !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    inspections: data ?? [],
    loading: ASSET_INSPECTIONS_AVAILABLE ? isLoading || orgLoading : false,
    error: error ? (error as Error).message : null,
    available: ASSET_INSPECTIONS_AVAILABLE,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-inspections", assetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail", orgId, assetId] });
    },
  };
}
