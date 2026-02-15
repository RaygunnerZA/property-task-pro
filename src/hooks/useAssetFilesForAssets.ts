import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

const IMAGE_TYPES = ["photo", "image", "certificate", "manual"];

function isImageUrl(url: string, fileType?: string | null): boolean {
  if (fileType && IMAGE_TYPES.some((t) => fileType.toLowerCase().includes(t))) return true;
  const ext = url.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

/**
 * Fetches first image URL per asset for list display.
 * Returns a Map of assetId -> image URL (or undefined if no image).
 */
export function useAssetFilesForAssets(assetIds: string[]) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: fileMap = new Map<string, string>(), isLoading } = useQuery({
    queryKey: ["asset-files-for-list", assetIds],
    queryFn: async () => {
      if (assetIds.length === 0) return new Map<string, string>();
      const { data: rows, error } = await supabase
        .from("asset_files")
        .select("asset_id, file_url, thumbnail_url, file_type")
        .in("asset_id", assetIds)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      const map = new Map<string, string>();
      const seen = new Set<string>();
      for (const row of rows ?? []) {
        if (seen.has(row.asset_id)) continue;
        if (isImageUrl(row.file_url, row.file_type)) {
          // Prefer thumbnail for fast card display; fallback to file_url
          const url = (row as { thumbnail_url?: string | null }).thumbnail_url || row.file_url;
          map.set(row.asset_id, url);
          seen.add(row.asset_id);
        }
      }
      return map;
    },
    enabled: !!orgId && !orgLoading && assetIds.length > 0,
    staleTime: 60000,
  });

  return { imageMap: fileMap, loading: isLoading || orgLoading };
}
