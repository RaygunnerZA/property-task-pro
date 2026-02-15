import { Badge } from "@/components/ui/badge";
import { Home, Building2, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getAssetIcon } from "@/lib/icon-resolver";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface PropertyForIcon {
  icon_name?: string | null;
  icon_color_hex?: string | null;
}

interface AssetCardProps {
  asset: AssetViewRow;
  propertyName?: string;
  property?: PropertyForIcon | null;
  spaceName?: string;
  imageUrl?: string;
  onClick?: () => void;
}

export function AssetCard({ asset, propertyName, property, spaceName, imageUrl, onClick }: AssetCardProps) {
  const conditionScore = asset.condition_score ?? 100;
  const assetName = asset.name || asset.serial_number || "Unnamed Asset";
  const propertyIconName = property?.icon_name || "home";
  const PropertyIcon = PROPERTY_ICONS[propertyIconName as keyof typeof PROPERTY_ICONS] || Home;
  const AssetIcon = getAssetIcon(asset.icon_name);
  const iconColor = property?.icon_color_hex || "#8EC9CE";

  const getConditionBadge = (score: number) => {
    if (score >= 80) return <Badge variant="success" size="sm" className="text-[10px] px-[5px] h-[24px]">Good</Badge>;
    if (score >= 60) return <Badge variant="warning" size="sm" className="text-[10px] px-[5px] h-[24px]">Fair</Badge>;
    return <Badge variant="danger" size="sm" className="text-[10px] px-[5px] h-[24px]">Poor</Badge>;
  };

  const dateAdded = asset.created_at
    ? formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })
    : null;

  return (
    <div
      className="rounded-[12px] bg-card shadow-e1 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 overflow-hidden flex flex-col"
      onClick={onClick}
    >
      {/* Image Zone - Top (stacked thumbnail like vertical task card) */}
      <div className="w-full h-[100px] relative flex-shrink-0">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={assetName}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) parent.classList.add("bg-muted");
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow:
                  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.15)",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: iconColor }}
          >
            <AssetIcon className="h-10 w-10 text-white/80" />
          </div>
        )}
        {/* Property Icon - top left overlay */}
        <div
          className="absolute top-2 left-2 rounded-[151px] flex items-center justify-center z-10"
          style={{
            backgroundColor: iconColor,
            width: "24px",
            height: "24px",
            boxShadow:
              "3px 3px 6px rgba(0,0,0,0.08), -2px -2px 4px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
          }}
        >
          <PropertyIcon className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pt-4 pb-3 px-[14px] flex flex-col">
        <h3 className="text-[16px] font-semibold text-foreground leading-tight line-clamp-2">
          {assetName}
        </h3>

        {/* Chips: Space, Date added, Condition */}
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          {spaceName && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] font-mono uppercase h-[24px]">
              {spaceName}
            </Badge>
          )}
          {dateAdded && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] h-[24px]">
              {dateAdded}
            </Badge>
          )}
          {getConditionBadge(conditionScore)}
          {asset.status && asset.status !== "active" && (
            <Badge variant={asset.status === "retired" ? "neutral" : "warning"} size="sm" className="text-[10px] px-[5px] h-[24px]">
              {asset.status}
            </Badge>
          )}
        </div>

        {/* Condition progress bar - bottom of card */}
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Condition</span>
            <span className="text-[10px] font-medium text-muted-foreground">{conditionScore}/100</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                conditionScore >= 80 ? "bg-green-500" : conditionScore >= 60 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${conditionScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
