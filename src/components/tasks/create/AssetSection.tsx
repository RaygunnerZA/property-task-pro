/**
 * AssetSection - Create Task "Asset" row (single-line, no panel)
 *
 * Behavior:
 * - Hover shows `+ Asset`
 * - Clicking `+ Asset` turns it into an inline input (100→240px)
 * - Typing shows `{+Existing}` matches from DB (scoped to property, and space if selected)
 * - Always offers `{ADD Value}` when no exact match; opens CreateAssetDialog prefilled
 * - No second row / no AssetPanel
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { SemanticChip } from "@/components/chips/semantic";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";

const INPUT_MIN_WIDTH = 100;
const INPUT_MAX_WIDTH = 240;
const INPUT_CH_WIDTH = 8;

interface AssetSuggestion {
  id: string;
  label: string;
  blockingRequired?: boolean;
  resolvedEntityId?: string;
}

interface AssetSectionProps {
  isActive: boolean;
  onActivate: () => void;
  propertyId?: string;
  spaceId?: string;
  selectedAssetIds: string[];
  onAssetsChange: (assetIds: string[]) => void;
  /** AI-detected asset chips (from rule-based extractor) */
  suggestedChips?: AssetSuggestion[];
}

export function AssetSection({
  isActive,
  onActivate,
  propertyId,
  spaceId,
  selectedAssetIds,
  onAssetsChange,
  suggestedChips = [],
}: AssetSectionProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [createAssetDefaultName, setCreateAssetDefaultName] = useState("");

  const loadAssets = async () => {
    if (!propertyId || !orgId) {
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from("assets")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("property_id", propertyId);
      if (spaceId) q = q.eq("space_id", spaceId);
      const { data, error } = await q;
      if (error) throw error;
      setAssets((data || []).map((a) => ({ id: a.id, name: a.name || "" })));
    } catch (err: any) {
      toast({ title: "Couldn't load assets", description: err.message, variant: "destructive" });
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, spaceId, orgId]);

  // Close inline editing when row deactivates
  useEffect(() => {
    if (!isActive) {
      setIsEditing(false);
      setQuery("");
    }
  }, [isActive]);

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const selectedAssets = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a.name]));
    return selectedAssetIds
      .map((id) => ({ id, name: map.get(id) }))
      .filter((x): x is { id: string; name: string } => !!x.name);
  }, [assets, selectedAssetIds]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return assets
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 4);
  }, [query, assets]);

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return assets.some((a) => a.name.toLowerCase() === q);
  }, [query, assets]);

  const inputWidth = Math.min(
    INPUT_MAX_WIDTH,
    Math.max(INPUT_MIN_WIDTH, (query.length + 2) * INPUT_CH_WIDTH)
  );

  const removeAsset = (assetId: string) => {
    onAssetsChange(selectedAssetIds.filter((id) => id !== assetId));
  };

  const addAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) return;
    onAssetsChange([...selectedAssetIds, assetId]);
    setIsEditing(false);
    setQuery("");
  };

  const handleAddAssetClick = () => {
    if (!propertyId) {
      toast({ title: "Select a property first", variant: "destructive" });
      return;
    }
    onActivate();
    setIsEditing(true);
    setQuery("");
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      <CreateAssetDialog
        open={showCreateAsset}
        onOpenChange={setShowCreateAsset}
        propertyId={propertyId || ""}
        spaceId={spaceId}
        defaultName={createAssetDefaultName}
        onAssetCreated={(assetId) => {
          onAssetsChange([...selectedAssetIds, assetId]);
          loadAssets();
        }}
      />

      <div className="flex items-center gap-2 h-[36px] min-w-0">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[8px] bg-background">
          <Box className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap pr-[6px]">
          {/* Fact chips */}
          {selectedAssets.map((a) => (
            <SemanticChip
              key={a.id}
              epistemic="fact"
              label={a.name.toUpperCase()}
              removable
              onRemove={() => removeAsset(a.id)}
              truncate
              className="shrink-0"
            />
          ))}

          {/* AI-suggested asset chips — shown when no assets selected and not editing */}
          {!isEditing && selectedAssetIds.length === 0 &&
            suggestedChips.map((chip) => (
              <SemanticChip
                key={chip.id}
                epistemic="proposal"
                label={`ADD ${chip.label.toUpperCase()}`}
                truncate={false}
                onPress={() => {
                  setCreateAssetDefaultName(chip.label);
                  setShowCreateAsset(true);
                }}
                className="shrink-0"
              />
            ))
          }

          {/* +Asset → input */}
          {isEditing ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setQuery("");
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = suggestions[0];
                    if (first) addAsset(first.id);
                    else if (query.trim() && !hasExactMatch) {
                      if (!propertyId) {
                        toast({ title: "Select a property first", variant: "destructive" });
                        return;
                      }
                      setCreateAssetDefaultName(query.trim());
                      setShowCreateAsset(true);
                    }
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsEditing(false);
                    setQuery("");
                  }, 150);
                }}
                placeholder="+ Asset"
                className={cn(
                  "h-[28px] w-[100px] min-w-[100px] max-w-[240px] rounded-[8px] px-2 py-1 shrink-0 flex-shrink-0",
                  "font-mono text-[11px] uppercase tracking-wide",
                  "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                  "shadow-inset outline-none cursor-text",
                  "transition-[width] duration-150 ease-out"
                )}
                style={{ width: inputWidth }}
              />

              {suggestions.map((a) => (
                <SemanticChip
                  key={a.id}
                  epistemic="proposal"
                  label={`+${a.name}`.toUpperCase()}
                  onPress={() => addAsset(a.id)}
                  truncate
                  className="shrink-0"
                />
              ))}

              {query.trim() && !hasExactMatch && (
                <SemanticChip
                  epistemic="proposal"
                  label={`ADD ${query.trim()}`.toUpperCase()}
                  onPress={() => {
                    if (!propertyId) {
                      toast({ title: "Select a property first", variant: "destructive" });
                      return;
                    }
                    setCreateAssetDefaultName(query.trim());
                    setShowCreateAsset(true);
                  }}
                  truncate
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                />
              )}
            </>
          ) : isHovered ? (
            <SemanticChip
              epistemic="proposal"
              label="+ Asset"
              truncate={false}
              onPress={handleAddAssetClick}
              pressOnPointerDown
              className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
            />
          ) : null}

          {loading && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground whitespace-nowrap shrink-0">
              Loading…
            </span>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

