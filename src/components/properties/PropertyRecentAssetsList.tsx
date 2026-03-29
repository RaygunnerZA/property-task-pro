import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Home, Building2, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useAssetFilesForAssets } from "@/hooks/useAssetFilesForAssets";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { getAssetIcon } from "@/lib/icon-resolver";
import { supabase } from "@/integrations/supabase/client";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const MAX_RECENT_CARDS = 8;
const iconColor = "#8EC9CE";

const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface RecentAssetCardProps {
  asset: AssetViewRow;
  imageUrl?: string;
  property?: { icon_name?: string | null; icon_color_hex?: string | null } | null;
  onAssetClick?: (assetId: string) => void;
}

function RecentAssetCard({ asset, imageUrl, property, onAssetClick }: RecentAssetCardProps) {
  const queryClient = useQueryClient();
  const assetName = asset.name || asset.serial_number || "Unnamed Asset";
  const taskCount = asset.open_tasks_count ?? 0;
  const conditionScore = asset.condition_score ?? 100;
  const AssetIcon = getAssetIcon(asset.icon_name);
  const propertyIconName = property?.icon_name || "home";
  const PropertyIcon = PROPERTY_ICONS[propertyIconName as keyof typeof PROPERTY_ICONS] || Home;
  const propColor = property?.icon_color_hex || iconColor;
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [iconValue, setIconValue] = useState({ iconName: asset.icon_name || "box", color: propColor });

  const getConditionLabel = (score: number) => {
    if (score >= 80) return "Good";
    if (score >= 60) return "Fair";
    return "Poor";
  };

  const getConditionVariant = (score: number): "success" | "warning" | "danger" => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "danger";
  };

  const handleClick = () => {
    if (asset.id) {
      onAssetClick?.(asset.id);
    }
  };

  return (
    <div
      className={cn(
        "bg-card/60 rounded-[8px] overflow-hidden shadow-e1 h-[155px] w-[120px] flex-shrink-0",
        "transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.99]"
      )}
      onClick={handleClick}
    >
      {/* Thumbnail / Icon zone */}
      <div
        className="w-full h-[63px] overflow-hidden relative"
        style={{ backgroundColor: iconColor }}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={assetName}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow:
                  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <AssetIcon className="h-8 w-8 text-white/80" />
          </div>
        )}
        {/* Asset icon - circle top left, clickable to change icon */}
        <button
          type="button"
          className="absolute top-2 left-2 rounded-full flex items-center justify-center z-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          style={{
            backgroundColor: propColor,
            width: "24px",
            height: "24px",
            boxShadow:
              "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIconValue({ iconName: asset.icon_name || "box", color: propColor });
            setIconDialogOpen(true);
          }}
        >
          <AssetIcon className="h-4 w-4 text-white" />
        </button>
      </div>

      <div className="pt-2.5 pb-2.5 pl-2.5 pr-2.5 space-y-2 h-[96px]">
        <div className="mb-[15px] mt-[4px] h-[22px] flex flex-col justify-center items-start">
          <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
            {assetName}
          </h3>
        </div>

        {/* Perforation line */}
        <div
          className="-ml-2.5 -mr-2.5 pt-0 pb-0 px-1"
          style={{
            height: "1px",
            backgroundImage:
              "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
            backgroundSize: "7px 1px",
            backgroundRepeat: "repeat-x",
            boxShadow:
              "1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)",
          }}
        />

        {/* Property icon (left) + Task count + Condition */}
        <div className="flex items-center gap-2 flex-wrap pb-[3px]" style={{ marginTop: '6px' }}>
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: propColor,
              width: "20px",
              height: "20px",
              boxShadow: "2px 2px 4px rgba(0,0,0,0.08), -1px -1px 2px rgba(255,255,255,0.4)",
            }}
          >
            <PropertyIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {taskCount} Task{taskCount !== 1 ? "s" : ""}
          </span>
          <Badge
            variant={getConditionVariant(conditionScore)}
            size="sm"
            className="text-[10px] px-[5px] h-[20px]"
          >
            {getConditionLabel(conditionScore)}
          </Badge>
        </div>
      </div>

      {/* Change Icon Dialog */}
      <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
        <DialogContent className="max-w-sm p-5" aria-describedby="asset-icon-desc">
          <DialogHeader>
            <DialogTitle>Change Icon</DialogTitle>
            <DialogDescription id="asset-icon-desc">
              Pick a new icon for <strong>{assetName}</strong>
            </DialogDescription>
          </DialogHeader>
          <AIIconColorPicker
            searchText={assetName}
            value={iconValue}
            onChange={(icon, color) => setIconValue({ iconName: icon, color })}
            suggestedIcon={asset.icon_name}
            showSearchInput
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIconDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const { error } = await supabase
                    .from("assets")
                    .update({ icon_name: iconValue.iconName })
                    .eq("id", asset.id);
                  if (error) throw error;
                  toast.success("Icon updated");
                  queryClient.invalidateQueries({ queryKey: ["assets"] });
                  setIconDialogOpen(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to update icon");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PropertyRecentAssetsListProps {
  propertyId: string;
  onAssetClick?: (assetId: string) => void;
  /** When true, omit section title (e.g. when used inside a concertina) */
  headless?: boolean;
}

/**
 * Recent Assets
 * Shows recently modified/created assets for the property (max 8)
 * Same format as Recent Spaces, with task count and condition
 */
export function PropertyRecentAssetsList({ propertyId, onAssetClick, headless = false }: PropertyRecentAssetsListProps) {
  const { data: assets = [], isLoading: assetsLoading } = useAssetsQuery(propertyId);
  const { data: properties = [] } = usePropertiesQuery();
  const property = useMemo(() => properties.find((p: any) => p.id === propertyId), [properties, propertyId]);

  const recentAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => {
        const aDate = new Date(
          (a as any).updated_at || (a as any).created_at || 0
        ).getTime();
        const bDate = new Date(
          (b as any).updated_at || (b as any).created_at || 0
        ).getTime();
        return bDate - aDate;
      })
      .slice(0, MAX_RECENT_CARDS) as AssetViewRow[];
  }, [assets]);

  const assetIds = useMemo(
    () => recentAssets.map((a) => a.id).filter(Boolean) as string[],
    [recentAssets]
  );
  const { imageMap } = useAssetFilesForAssets(assetIds);

  return (
    <div className={cn(headless ? "pt-0 px-2 pb-3" : "border-t border-border pt-4 px-2 pb-3")}>
      {!headless && (
        <h2 className="text-base font-semibold text-foreground mb-3">
          Recent Assets
        </h2>
      )}
      <div className={cn("w-full max-w-full overflow-x-hidden", headless ? "pt-0" : "pt-[2px]")}>
        {assetsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : recentAssets.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">No assets yet</p>
          </div>
        ) : (
          <div className="relative w-full max-w-full overflow-hidden">
            <div
              className="overflow-x-auto -ml-4 pl-4 pr-4 scrollbar-hz-teal min-w-0"
              style={{ width: "calc(100% + 15px)" }}
            >
              <div
                className="flex gap-2.5 h-[165px]"
                style={{ width: "max-content" }}
              >
                {recentAssets.map((asset) => (
                  <RecentAssetCard
                    key={asset.id}
                    asset={asset}
                    imageUrl={asset.id ? imageMap.get(asset.id) : undefined}
                    property={property}
                    onAssetClick={onAssetClick}
                  />
                ))}
              </div>
            </div>
            <div
              className="absolute top-0 right-0 bottom-0 pointer-events-none"
              style={{
                width: "10px",
                height: "155px",
                background:
                  "linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))",
                zIndex: 20,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
