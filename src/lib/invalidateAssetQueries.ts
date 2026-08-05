import type { QueryClient } from "@tanstack/react-query";

/** Invalidate every React Query cache that lists or summarizes assets. */
export function invalidateAssetQueries(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["assets"] }),
    queryClient.invalidateQueries({ queryKey: ["asset-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["asset-files"] }),
    queryClient.invalidateQueries({ queryKey: ["asset-files-for-list"] }),
    // properties_view.assets_count and hub tiles
    queryClient.invalidateQueries({ queryKey: ["properties"] }),
  ]).then(() => undefined);
}
