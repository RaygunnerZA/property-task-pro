import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AssetDetailRow = Tables<"assets"> & {
  property_name?: string | null;
  property_address?: string | null;
  space_name?: string | null;
  open_tasks_count?: number | null;
};

export function useAssetDetail(assetId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-detail", orgId, assetId],
    queryFn: async () => {
      if (!assetId || !orgId) return null;
      const { data: row, error: err } = await supabase
        .from("assets_view")
        .select("*")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .single();

      if (err) throw err;
      return row as AssetDetailRow | null;
    },
    enabled: !!orgId && !!assetId && !orgLoading,
    staleTime: 60000,
  });

  return {
    asset: data ?? null,
    loading: isLoading || orgLoading,
    error: error ? (error as Error).message : null,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail", orgId, assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  };
}
