import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { OnboardingAssetGroupCard } from "@/components/onboarding/OnboardingAssetGroupCard";
import { OnboardingAssetCustomCollectionCard } from "@/components/onboarding/OnboardingAssetCustomCollectionCard";
import { OnboardingAssetCustomCollectionDraftCard } from "@/components/onboarding/OnboardingAssetCustomCollectionDraftCard";
import {
  ONBOARDING_ASSET_GROUPS,
  getAssetGroupById,
  getGroupIdFromAssetType,
  isCustomAssetCollectionGroupId,
  type AssetSuggestionLabelOverrides,
  type GroupExtraAsset,
  type OnboardingAssetCustomCollection,
} from "@/components/onboarding/onboardingAssetGroups";
import {
  createPropertyAssetCustomCollection,
  loadPropertyCustomAssetGroups,
  savePropertyCustomAssetGroups,
} from "@/lib/propertyCustomAssetGroupsStorage";
import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { invalidateAssetQueries } from "@/lib/invalidateAssetQueries";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

type PropertyAssetGroupCarouselProps = {
  propertyId: string;
  className?: string;
  assetFilter?: string;
  onViewAsset?: (assetId: string) => void;
};

function resolveAssetGroupId(
  asset: AssetViewRow,
  assetToCollection: Record<string, string>
): string | undefined {
  const nameKey = (asset.name ?? "").toLowerCase().trim();
  if (nameKey && assetToCollection[nameKey]) {
    return assetToCollection[nameKey];
  }
  if (asset.asset_type) {
    const fromType = getGroupIdFromAssetType(asset.asset_type);
    if (fromType) return fromType;
  }
  const name = asset.name?.trim();
  if (!name) return undefined;
  const matching = ONBOARDING_ASSET_GROUPS.filter((g) =>
    g.suggestedAssets.some((s) => s.toLowerCase() === name.toLowerCase())
  );
  return matching.length === 1 ? matching[0].id : undefined;
}

function isSuggestionForGroup(name: string, groupId: string): boolean {
  const group = getAssetGroupById(groupId);
  if (!group) return false;
  const key = name.toLowerCase().trim();
  return group.suggestedAssets.some((s) => s.toLowerCase().trim() === key);
}

function defaultAssetTypeForGroup(groupId: string): string | null {
  const group = getAssetGroupById(groupId);
  if (!group?.assetTypes?.length) return null;
  const raw = group.assetTypes[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function PropertyAssetGroupCarousel({
  propertyId,
  className,
  assetFilter = "",
  onViewAsset,
}: PropertyAssetGroupCarouselProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: assets = [], refetch } = useAssetsQuery(propertyId);

  const [renameModal, setRenameModal] = useState<{
    assetId: string;
    currentName: string;
    groupId: string;
  } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [copyModal, setCopyModal] = useState<{
    baseName: string;
    suggestedName: string;
    groupId: string;
  } | null>(null);
  const [copyInput, setCopyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [customCollections, setCustomCollections] = useState<OnboardingAssetCustomCollection[]>([]);
  const [assetToCollection, setAssetToCollection] = useState<Record<string, string>>({});
  const [suggestionLabelOverrides, setSuggestionLabelOverrides] =
    useState<AssetSuggestionLabelOverrides>({});
  const [pendingPinsByGroup, setPendingPinsByGroup] = useState<Record<string, string[]>>({});
  const skipPersistCustomGroupsRef = useRef(true);

  useEffect(() => {
    skipPersistCustomGroupsRef.current = true;
    const stored = loadPropertyCustomAssetGroups(propertyId);
    setCustomCollections(stored.collections);
    setAssetToCollection(stored.assetToCollection);
    setSuggestionLabelOverrides(stored.suggestionLabelOverrides);
    queueMicrotask(() => {
      skipPersistCustomGroupsRef.current = false;
    });
  }, [propertyId]);

  useEffect(() => {
    if (skipPersistCustomGroupsRef.current) return;
    savePropertyCustomAssetGroups(propertyId, {
      collections: customCollections,
      assetToCollection,
      suggestionLabelOverrides,
    });
  }, [propertyId, customCollections, assetToCollection, suggestionLabelOverrides]);

  const assignAssetToCollection = useCallback((name: string, collectionId: string) => {
    const key = name.toLowerCase().trim();
    setAssetToCollection((prev) => ({ ...prev, [key]: collectionId }));
  }, []);

  const unassignAsset = useCallback((name: string) => {
    const key = name.toLowerCase().trim();
    setAssetToCollection((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearSuggestionOverridesForName = useCallback((name: string) => {
    const key = name.toLowerCase().trim();
    setSuggestionLabelOverrides((prev) => {
      let changed = false;
      const next: AssetSuggestionLabelOverrides = { ...prev };
      if (next[key]) {
        delete next[key];
        changed = true;
      }
      for (const [source, label] of Object.entries(next)) {
        if (label.toLowerCase().trim() === key) {
          delete next[source];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const selectedAssetsSet = useMemo(() => {
    const set = new Set(
      assets.map((a) => (a.name ?? "").toLowerCase().trim()).filter(Boolean)
    );
    for (const pins of Object.values(pendingPinsByGroup)) {
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (key) set.add(key);
      }
    }
    return set;
  }, [assets, pendingPinsByGroup]);

  useEffect(() => {
    const existing = new Set(
      assets.map((a) => (a.name ?? "").toLowerCase().trim()).filter(Boolean)
    );
    setPendingPinsByGroup((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      for (const [groupId, pins] of Object.entries(prev)) {
        const remaining = pins.filter((name) => !existing.has(name.toLowerCase().trim()));
        if (remaining.length !== pins.length) changed = true;
        if (remaining.length > 0) next[groupId] = remaining;
        else if (pins.length > 0) changed = true;
      }
      return changed ? next : prev;
    });
  }, [assets]);

  const pinAssetOptimistic = useCallback((name: string, groupId: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    setPendingPinsByGroup((prev) => {
      const existing = (prev[groupId] ?? []).filter((n) => n.toLowerCase().trim() !== key);
      return { ...prev, [groupId]: [trimmed, ...existing] };
    });
  }, []);

  const selectedAssetsNewestFirstByGroup = useMemo(() => {
    const result: Record<string, string[]> = {};
    const sorted = [...assets].sort((a, b) => {
      const aDate = new Date((a as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
      const bDate = new Date((b as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
      return bDate - aDate;
    });
    for (const asset of sorted) {
      const name = asset.name?.trim();
      if (!name) continue;
      const groupId = resolveAssetGroupId(asset, assetToCollection);
      if (!groupId) continue;
      if (!result[groupId]) result[groupId] = [];
      result[groupId].push(name);
    }
    for (const [groupId, pins] of Object.entries(pendingPinsByGroup)) {
      if (!pins.length) continue;
      const existingKeys = new Set(
        (result[groupId] ?? []).map((n) => n.toLowerCase().trim())
      );
      const pendingOnly = pins.filter((n) => !existingKeys.has(n.toLowerCase().trim()));
      result[groupId] = [...pendingOnly, ...(result[groupId] ?? [])];
    }
    return result;
  }, [assets, assetToCollection, pendingPinsByGroup]);

  const extraAssetsByGroup = useMemo(() => {
    const result: Record<string, GroupExtraAsset[]> = {};
    const sorted = [...assets].sort((a, b) => {
      const aDate = new Date((a as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
      const bDate = new Date((b as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
      return bDate - aDate;
    });
    for (const asset of sorted) {
      const name = asset.name?.trim();
      if (!name) continue;
      const groupId = resolveAssetGroupId(asset, assetToCollection);
      if (!groupId) continue;
      if (isCustomAssetCollectionGroupId(groupId)) {
        if (!result[groupId]) result[groupId] = [];
        result[groupId].push({ name });
        continue;
      }
      if (isSuggestionForGroup(name, groupId)) continue;
      if (!result[groupId]) result[groupId] = [];
      result[groupId].push({ name });
    }
    for (const [groupId, pins] of Object.entries(pendingPinsByGroup)) {
      if (!pins.length) continue;
      const existingKeys = new Set(
        (result[groupId] ?? []).map((e) => e.name.toLowerCase().trim())
      );
      const pendingExtras: GroupExtraAsset[] = [];
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (existingKeys.has(key)) continue;
        if (!isCustomAssetCollectionGroupId(groupId) && isSuggestionForGroup(name, groupId)) {
          continue;
        }
        pendingExtras.push({ name });
        existingKeys.add(key);
      }
      if (pendingExtras.length) {
        result[groupId] = [...pendingExtras, ...(result[groupId] ?? [])];
      }
    }
    return result;
  }, [assets, assetToCollection, pendingPinsByGroup]);

  const filterKey = assetFilter.trim().toLowerCase();

  const groupMatchesFilter = useCallback(
    (groupId: string) => {
      if (!filterKey) return true;
      const selected = selectedAssetsNewestFirstByGroup[groupId] ?? [];
      return selected.some((n) => n.toLowerCase().includes(filterKey));
    },
    [filterKey, selectedAssetsNewestFirstByGroup]
  );

  const visibleGroups = useMemo(
    () => ONBOARDING_ASSET_GROUPS.filter((group) => groupMatchesFilter(group.id)),
    [groupMatchesFilter]
  );

  const visibleCustomCollections = useMemo(
    () => customCollections.filter((collection) => groupMatchesFilter(collection.id)),
    [customCollections, groupMatchesFilter]
  );

  const hasVisibleGroups = visibleGroups.length > 0 || visibleCustomCollections.length > 0;

  const invalidateAssets = useCallback(async () => {
    await invalidateAssetQueries(queryClient);
    await refetch();
  }, [queryClient, refetch]);

  const findAssetByName = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      return assets.find((a) => (a.name ?? "").toLowerCase().trim() === key);
    },
    [assets]
  );

  const openRenameModal = useCallback(
    (name: string, groupId: string) => {
      const asset = findAssetByName(name);
      if (!asset?.id) return;
      setRenameModal({ assetId: asset.id, currentName: name, groupId });
      setRenameInput(name);
    },
    [findAssetByName]
  );

  const viewAssetByNameKey = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    for (const asset of assets) {
      const key = (asset.name ?? "").toLowerCase().trim();
      if (!key || handlers[key] || !asset.id) continue;
      const assetId = asset.id;
      handlers[key] = () => onViewAsset?.(assetId);
    }
    return handlers;
  }, [assets, onViewAsset]);

  const openViewAsset = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      const direct = viewAssetByNameKey[key];
      if (direct) {
        direct();
        return;
      }
      const asset = findAssetByName(name);
      if (!asset?.id) {
        toast.error("Asset not found");
        return;
      }
      onViewAsset?.(asset.id);
    },
    [viewAssetByNameKey, findAssetByName, onViewAsset]
  );

  const getSuggestedCopyName = useCallback(
    (baseName: string): string => {
      const base = baseName.trim();
      const baseLower = base.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${baseLower}(?:\\s+(\\d+))?$`, "i");
      let maxNum = 0;
      for (const asset of assets) {
        const name = (asset.name ?? "").trim();
        const m = name.match(re);
        if (m) {
          const n = m[1] ? parseInt(m[1], 10) : 1;
          if (n > maxNum) maxNum = n;
        }
      }
      return `${base} ${maxNum + 1}`;
    },
    [assets]
  );

  const createAsset = async (name: string, groupId: string) => {
    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedAssetsSet.has(trimmed.toLowerCase())) {
      toast.error("Asset already exists");
      return;
    }

    pinAssetOptimistic(trimmed, groupId);
    setBusy(true);
    try {
      const assetType = defaultAssetTypeForGroup(groupId);
      const { error } = await supabase.from("assets").insert({
        org_id: orgId,
        property_id: propertyId,
        name: trimmed,
        asset_type: assetType,
        condition_score: 100,
        status: "active",
        icon_name: "box",
      });
      if (error) throw error;
      assignAssetToCollection(trimmed, groupId);
      toast.success(`Added ${trimmed}`);
      await invalidateAssets();
    } catch (err: unknown) {
      setPendingPinsByGroup((prev) => {
        const pins = prev[groupId];
        if (!pins?.length) return prev;
        const remaining = pins.filter((n) => n.toLowerCase().trim() !== trimmed.toLowerCase());
        if (remaining.length === pins.length) return prev;
        const next = { ...prev };
        if (remaining.length) next[groupId] = remaining;
        else delete next[groupId];
        return next;
      });
      const message = err instanceof Error ? err.message : "Failed to add asset";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (name: string) => {
    const asset = findAssetByName(name);
    if (!asset?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("assets").delete().eq("id", asset.id);
      if (error) throw error;
      unassignAsset(name);
      clearSuggestionOverridesForName(name);
      toast.success(`Removed ${name}`);
      await invalidateAssets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove asset";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCustomCollection = (name: string) => {
    const collection = createPropertyAssetCustomCollection(name);
    setCustomCollections((prev) => [...prev, collection]);
  };

  const handleUpdateCustomCollection = (
    id: string,
    updates: { name?: string; imageSrc?: string }
  ) => {
    setCustomCollections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (updates.imageSrc && c.imageSrc?.startsWith("blob:") && c.imageSrc !== updates.imageSrc) {
          URL.revokeObjectURL(c.imageSrc);
        }
        return { ...c, ...updates };
      })
    );
  };

  const confirmRename = async () => {
    if (!renameModal) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    const newKey = trimmed.toLowerCase().trim();
    const oldKey = renameModal.currentName.toLowerCase().trim();
    if (newKey !== oldKey && selectedAssetsSet.has(newKey)) {
      toast.error("Asset already exists");
      return;
    }

    const asset =
      assets.find((a) => a.id === renameModal.assetId) ??
      findAssetByName(renameModal.currentName);
    const groupId =
      renameModal.groupId ||
      (asset ? resolveAssetGroupId(asset, assetToCollection) : undefined) ||
      assetToCollection[oldKey];

    setBusy(true);
    try {
      const { error } = await supabase
        .from("assets")
        .update({ name: trimmed })
        .eq("id", renameModal.assetId);
      if (error) throw error;

      if (newKey !== oldKey && groupId) {
        setAssetToCollection((prev) => {
          const next = { ...prev };
          delete next[oldKey];
          next[newKey] = groupId;
          return next;
        });
      }

      if (newKey !== oldKey) {
        setSuggestionLabelOverrides((prev) => {
          const next: AssetSuggestionLabelOverrides = { ...prev };
          let changed = false;

          if (groupId && isSuggestionForGroup(renameModal.currentName, groupId)) {
            next[oldKey] = trimmed;
            changed = true;
          }

          for (const [source, label] of Object.entries(next)) {
            if (label.toLowerCase().trim() === oldKey) {
              next[source] = trimmed;
              changed = true;
            }
          }

          return changed ? next : prev;
        });
      }

      toast.success("Asset renamed");
      setRenameModal(null);
      setRenameInput("");
      await invalidateAssets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to rename asset";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = async () => {
    if (!copyModal) return;
    const trimmed = copyInput.trim();
    if (!trimmed) return;
    if (selectedAssetsSet.has(trimmed.toLowerCase())) {
      toast.error("Asset already exists");
      return;
    }
    await createAsset(trimmed, copyModal.groupId);
    setCopyModal(null);
    setCopyInput("");
  };

  if (filterKey && !hasVisibleGroups) {
    return null;
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <div
            className="rounded-xl bg-primary p-2.5"
            style={{
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
            }}
          >
            <Package className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Asset groups</h2>
        </div>
        {!filterKey ? (
          <p className="text-sm text-muted-foreground">
            Hover a group to browse suggestions, add assets, or manage what you already have.
          </p>
        ) : null}
        <SpaceGroupCarousel>
          {visibleGroups.map((group) => (
            <OnboardingAssetGroupCard
              key={group.id}
              group={group}
              selectedAssetsSet={selectedAssetsSet}
              extraAssets={extraAssetsByGroup[group.id] ?? []}
              selectedAssetsNewestFirst={selectedAssetsNewestFirstByGroup[group.id] ?? []}
              assetFilter={assetFilter}
              suggestionLabelOverrides={suggestionLabelOverrides}
              onAddAsset={(name) => createAsset(name, group.id)}
              onRemoveAsset={removeAsset}
              onRenameAsset={openRenameModal}
              onViewAsset={(name) => openViewAsset(name)}
              viewAssetByNameKey={viewAssetByNameKey}
              onCopyAsset={(name, groupId) => {
                const suggested = getSuggestedCopyName(name);
                setCopyModal({ baseName: name, suggestedName: suggested, groupId });
                setCopyInput(suggested);
              }}
            />
          ))}
          {visibleCustomCollections.map((collection) => (
            <OnboardingAssetCustomCollectionCard
              key={collection.id}
              collection={collection}
              selectedAssetsSet={selectedAssetsSet}
              extraAssets={extraAssetsByGroup[collection.id] ?? []}
              assetFilter={assetFilter}
              onAddAsset={(name) => createAsset(name, collection.id)}
              onRemoveAsset={removeAsset}
              onRenameAsset={openRenameModal}
              onViewAsset={(name) => openViewAsset(name)}
              viewAssetByNameKey={viewAssetByNameKey}
              onCopyAsset={(name, groupId) => {
                const suggested = getSuggestedCopyName(name);
                setCopyModal({ baseName: name, suggestedName: suggested, groupId });
                setCopyInput(suggested);
              }}
              onUpdateCollection={handleUpdateCustomCollection}
            />
          ))}
          {!filterKey ? (
            <OnboardingAssetCustomCollectionDraftCard
              onCreateCollection={handleCreateCustomCollection}
            />
          ) : null}
        </SpaceGroupCarousel>
      </div>

      <Dialog open={!!renameModal} onOpenChange={(open) => !open && setRenameModal(null)}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wider">
              Rename asset
            </DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmRename();
              }
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <NeomorphicButton variant="ghost" onClick={() => setRenameModal(null)}>
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              variant="primary"
              onClick={() => void confirmRename()}
              disabled={!renameInput.trim() || busy}
            >
              Save
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!copyModal} onOpenChange={(open) => !open && setCopyModal(null)}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wider">
              New asset name
            </DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={copyInput}
            onChange={(e) => setCopyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmCopy();
              }
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <NeomorphicButton variant="ghost" onClick={() => setCopyModal(null)}>
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              variant="primary"
              onClick={() => void confirmCopy()}
              disabled={!copyInput.trim() || busy}
            >
              Add
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
