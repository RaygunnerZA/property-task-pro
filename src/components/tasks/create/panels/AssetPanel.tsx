/**
 * AssetPanel - Asset Context Resolver
 * 
 * Rules:
 * - Assets are always contextual
 * - An Asset chip is only valid if Where is resolved (property required, space preferred)
 * - Assets always belong to a Property and optionally a Space / SubSpace
 */

import React, { useState, useEffect } from "react";
import { Package, Plus } from "lucide-react";
import { Chip } from "@/components/chips/Chip";
import { ContextResolver } from "../ContextResolver";
import { InstructionBlock } from "../InstructionBlock";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AssetPanelProps {
  propertyId?: string;
  spaceId?: string;
  selectedAssetIds: string[];
  onAssetsChange: (assetIds: string[]) => void;
  suggestedAssets?: string[];
  instructionBlock?: { section: string; entityName: string; entityType: string } | null;
  onInstructionDismiss?: () => void;
}

export function AssetPanel({
  propertyId,
  spaceId,
  selectedAssetIds,
  onAssetsChange,
  suggestedAssets = [],
  instructionBlock,
  onInstructionDismiss
}: AssetPanelProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  
  // Check if instruction block should be shown (only for 'what' section and 'asset' type)
  const showInstruction = instructionBlock?.section === 'what' && instructionBlock?.entityType === 'asset';
  const assetName = instructionBlock?.entityName;
  
  // Check if entity is now resolved (asset exists)
  const isResolved = assetName ? (
    assets.some(a => a.name.toLowerCase() === assetName.toLowerCase()) ||
    selectedAssetIds.some(id => id.includes(`ghost-asset-${assetName.toLowerCase()}`))
  ) : false;
  
  // Auto-dismiss instruction block when resolved
  useEffect(() => {
    if (showInstruction && isResolved && onInstructionDismiss) {
      onInstructionDismiss();
    }
  }, [showInstruction, isResolved, onInstructionDismiss, assets, selectedAssetIds, assetName]);

  // Load assets filtered by property and space
  const loadAssets = async () => {
    if (!propertyId || !orgId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('assets')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('property_id', propertyId);

      if (spaceId) {
        query = query.eq('space_id', spaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssets(data || []);
    } catch (err: any) {
      console.error('Error loading assets:', err);
      toast({
        title: "Couldn't load assets",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load assets when property/space changes
  useEffect(() => {
    if (propertyId) {
      loadAssets();
    } else {
      setAssets([]);
    }
  }, [propertyId, spaceId, orgId]);

  const filteredAssets = assets;

  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onAssetsChange(selectedAssetIds.filter(id => id !== assetId));
    } else {
      onAssetsChange([...selectedAssetIds, assetId]);
    }
  };

  if (!propertyId) {
    return (
      <ContextResolver
        title="Pick a property first to see assets."
        helperText="Assets"
      >
        <p className="text-xs text-muted-foreground">
          Assets are linked to properties. Pick one to continue.
        </p>
      </ContextResolver>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instruction Block - Show when asset is not in system */}
      {showInstruction && !isResolved && assetName && propertyId && (
        <InstructionBlock
          message={`${assetName} isn't in the system yet. Choose how you'd like to add it.`}
          buttons={[
            {
              label: "Create asset",
              helperText: "Add this asset to the selected property or space",
              onClick: () => {
                // TODO: Open asset creation dialog
                toast({ title: "Asset creation coming soon", description: `Would create "${assetName}"` });
              },
            },
          ]}
          onDismiss={onInstructionDismiss}
        />
      )}
      
      <ContextResolver
        title=""
        helperText=""
      >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* ASSETS + chip - Fixed on left */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
          >
            <span className="text-[12px] uppercase leading-[16px]">ASSETS</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
          
          {/* Scrollable middle section with asset chips */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
            <div className="flex items-center gap-2 h-[40px]">
              {loading ? (
                <p className="text-xs text-muted-foreground whitespace-nowrap">Loading assets...</p>
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <Chip
                    key={asset.id}
                    role="filter"
                    label={asset.name.toUpperCase()}
                    selected={selectedAssetIds.includes(asset.id)}
                    onSelect={() => toggleAsset(asset.id)}
                    className="shrink-0"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  No assets yet
                </p>
              )}
            </div>
          </div>
        </div>
      </ContextResolver>
    </div>
  );
}
