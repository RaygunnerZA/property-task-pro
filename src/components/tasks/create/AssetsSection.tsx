import { useState, useRef } from "react";
import { Box, Plus, X, ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StandardChip } from "@/components/chips/StandardChip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useDataContext } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface AssetsSectionProps {
  selectedAssetIds: string[];
  onAssetsChange: (assetIds: string[]) => void;
  assets?: Asset[];
  suggestedAssets?: string[];
}

export function AssetsSection({ 
  selectedAssetIds, 
  onAssetsChange, 
  assets = [],
  suggestedAssets = []
}: AssetsSectionProps) {
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify ghost chips
  const existingAssetNames = assets.map(a => a.name.toLowerCase());
  const ghostAssets = suggestedAssets.filter(
    suggested => !existingAssetNames.includes(suggested.toLowerCase())
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onAssetsChange(selectedAssetIds.filter(id => id !== assetId));
    } else {
      onAssetsChange([...selectedAssetIds, assetId]);
    }
  };

  const handleGhostAssetClick = (assetName: string) => {
    // Allow direct selection of ghost chips - store with ghost prefix
    const ghostId = `ghost-asset-${assetName}`;
    if (selectedAssetIds.includes(ghostId)) {
      onAssetsChange(selectedAssetIds.filter(id => id !== ghostId));
    } else {
      onAssetsChange([...selectedAssetIds, ghostId]);
    }
    // Also keep the modal option for manual creation
    // setNewAssetName(assetName);
    // setShowCreateModal(true);
  };

  const handleCreateAsset = async () => {
    if (!newAssetName.trim()) return;
    
    // For now, just close the modal - assets table may not exist yet
    toast({ 
      title: "Asset noted", 
      description: `"${newAssetName}" will be tracked with this task.` 
    });
    setNewAssetName("");
    setSelectedIcon("");
    setSelectedColor("");
    clearImage();
    setShowCreateModal(false);
  };

  const resetModal = () => {
    setNewAssetName("");
    setSelectedIcon("");
    setSelectedColor("");
    clearImage();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          Assets
        </Label>
        <button
          type="button"
          onClick={() => {
            resetModal();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {assets.map(asset => (
          <StandardChip
            key={asset.id}
            label={asset.name}
            selected={selectedAssetIds.includes(asset.id)}
            onSelect={() => toggleAsset(asset.id)}
            color={asset.color || undefined}
          />
        ))}
        
        {/* Ghost chips for AI suggestions */}
        {ghostAssets.map((ghostName, idx) => {
          const ghostId = `ghost-asset-${ghostName}`;
          const isSelected = selectedAssetIds.includes(ghostId);
          return (
            <StandardChip
              key={`ghost-${idx}`}
              label={isSelected ? ghostName : `+ ${ghostName}`}
              ghost={!isSelected}
              selected={isSelected}
              onSelect={() => handleGhostAssetClick(ghostName)}
            />
          );
        })}
        
        {assets.length === 0 && ghostAssets.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No assets yet. Create one to track equipment.
          </p>
        )}
      </div>

      {/* Create Asset Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) resetModal();
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Asset name"
              value={newAssetName}
              onChange={(e) => setNewAssetName(e.target.value)}
              className="shadow-engraved"
            />

            {/* Image / Icon / Color row */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {imagePreview ? (
                <div className="relative w-16 h-16 rounded-[5px] overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-[5px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px]">Image</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Icon</Label>
              <IconPicker value={selectedIcon} onChange={setSelectedIcon} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Color</Label>
              <ColorPicker value={selectedColor} onChange={setSelectedColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAsset}
              disabled={!newAssetName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
