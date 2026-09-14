import { useMemo } from "react";
import { CheckSquare } from "lucide-react";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { getAssetIcon } from "@/lib/icon-resolver";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentPanel, RecentPanelRow } from "@/components/property-workspace";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const MAX_RECENT_CARDS = 8;

interface PropertyRecentAssetsListProps {
  propertyId: string;
  onAssetClick?: (assetId: string) => void;
  /** When true, omit section title (e.g. when used inside a concertina) */
  headless?: boolean;
}

/**
 * Recent Assets — same pressed Recent rows as Spaces / Tasks / Records.
 * One surface per row (no outer card wrapping mini-cards).
 */
export function PropertyRecentAssetsList({
  propertyId,
  onAssetClick,
  headless = false,
}: PropertyRecentAssetsListProps) {
  const { data: assets = [], isLoading: assetsLoading } = useAssetsQuery(propertyId);

  const recentAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => {
        const aDate = new Date(
          (a as { updated_at?: string; created_at?: string }).updated_at ||
            (a as { created_at?: string }).created_at ||
            0
        ).getTime();
        const bDate = new Date(
          (b as { updated_at?: string; created_at?: string }).updated_at ||
            (b as { created_at?: string }).created_at ||
            0
        ).getTime();
        return bDate - aDate;
      })
      .slice(0, MAX_RECENT_CARDS) as AssetViewRow[];
  }, [assets]);

  return (
    <div className={cn("w-full min-w-0", headless ? "pt-0" : "pt-1")}>
      <RecentPanel
        title={headless ? "Recent" : "Recent Assets"}
        empty={
          assetsLoading ? null : (
            <div className="py-6 text-center">
              <p className="text-xs text-muted-foreground">No assets yet</p>
            </div>
          )
        }
      >
        {!assetsLoading && recentAssets.length > 0
          ? recentAssets.map((asset) => {
              const assetName = asset.name || asset.serial_number || "Unnamed Asset";
              const taskCount = asset.open_tasks_count ?? 0;
              const AssetIcon = getAssetIcon(asset.icon_name);
              return (
                <RecentPanelRow
                  key={asset.id}
                  onClick={() => {
                    if (asset.id) onAssetClick?.(asset.id);
                  }}
                  icon={<AssetIcon className="h-4 w-4 text-primary" aria-hidden />}
                  title={assetName}
                  caption={
                    <span className="inline-flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" aria-hidden />
                      {taskCount} task{taskCount === 1 ? "" : "s"}
                    </span>
                  }
                />
              );
            })
          : null}
      </RecentPanel>
      {assetsLoading ? (
        <div className="mt-1.5 space-y-2">
          <Skeleton className="h-12 w-full rounded-[5px]" />
          <Skeleton className="h-12 w-full rounded-[5px]" />
        </div>
      ) : null}
    </div>
  );
}
