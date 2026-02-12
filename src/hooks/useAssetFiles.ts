import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AssetFileRow = Tables<"asset_files">;

export function useAssetFiles(assetId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-files", assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const { data: rows, error: err } = await supabase
        .from("asset_files")
        .select("*")
        .eq("asset_id", assetId)
        .order("uploaded_at", { ascending: false });

      if (err) throw err;
      return (rows ?? []) as AssetFileRow[];
    },
    enabled: !!assetId && !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    files: data ?? [],
    loading: isLoading || orgLoading,
    error: error ? (error as Error).message : null,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-files", assetId] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail", orgId, assetId] });
    },
  };
}
