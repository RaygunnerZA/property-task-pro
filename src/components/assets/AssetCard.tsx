import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getAssetIcon } from "@/lib/icon-resolver";
import { supabase } from "@/integrations/supabase/client";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

interface PropertyForIcon {
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

export function AssetCard({ asset, property, spaceName, imageUrl, onClick }: AssetCardProps) {
  const queryClient = useQueryClient();
  const conditionScore = asset.condition_score ?? 100;
  const assetName = asset.name || asset.serial_number || "Unnamed Asset";
  const AssetIcon = getAssetIcon(asset.icon_name);
  const iconColor = property?.icon_color_hex || "#8EC9CE";
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [iconValue, setIconValue] = useState({ iconName: asset.icon_name || "box", color: iconColor });

  const getConditionBadge = (score: number) => {
    if (score >= 80) return <Badge variant="success" size="sm" className="text-[10px] px-[5px] h-[22px]">Good</Badge>;
    if (score >= 60) return <Badge variant="warning" size="sm" className="text-[10px] px-[5px] h-[22px]">Fair</Badge>;
    return <Badge variant="danger" size="sm" className="text-[10px] px-[5px] h-[22px]">Poor</Badge>;
  };

  const dateAdded = asset.created_at
    ? format(new Date(asset.created_at), "d MMM yy")
    : null;

  return (
    <div
      className="rounded-[12px] bg-white/50 shadow-e1 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 overflow-hidden flex flex-col h-[126px]"
      onClick={onClick}
    >
      {/* Top band: photo or solid property colour */}
      <div
        className="w-full h-[12px] relative flex-shrink-0"
        style={!imageUrl ? { backgroundColor: iconColor } : undefined}
      >
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
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 max-h-[143px] pt-2 pb-2 px-3 flex flex-col">
        <div className="flex justify-start items-center gap-2 min-w-0 shrink-0">
          <h3 className="flex-1 min-w-0 text-[15px] font-semibold text-foreground leading-tight line-clamp-2">
            {assetName}
          </h3>
          <button
            type="button"
            className="rounded-full flex items-center justify-center z-10 flex-shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            style={{
              backgroundColor: iconColor,
              width: "28px",
              height: "28px",
              boxShadow:
                "3px 3px 6px rgba(0,0,0,0.08), -2px -2px 4px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIconValue({ iconName: asset.icon_name || "box", color: iconColor });
              setIconDialogOpen(true);
            }}
            aria-label="Change asset icon"
          >
            <AssetIcon className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Chips: space, date, condition */}
        <div className="mt-1.5 flex gap-1.5 flex-wrap items-center shrink-0">
          {spaceName && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] font-mono uppercase h-[22px]">
              {spaceName}
            </Badge>
          )}
          {dateAdded && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] h-[22px] tabular-nums">
              {dateAdded}
            </Badge>
          )}
          {getConditionBadge(conditionScore)}
          {asset.status && asset.status !== "active" && (
            <Badge variant={asset.status === "retired" ? "neutral" : "warning"} size="sm" className="text-[10px] px-[5px] h-[22px]">
              {asset.status}
            </Badge>
          )}
        </div>

        {/* Condition progress bar - bottom of card */}
        <div className="mt-1 pt-1 px-0.5 border-t border-border/30 shrink-0">
          <div className="flex items-center justify-between mb-0.5 pb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Condition</span>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{conditionScore}/100</span>
          </div>
          <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-all ${
                conditionScore >= 80 ? "bg-green-500" : conditionScore >= 60 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${conditionScore}%` }}
            />
          </div>
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
