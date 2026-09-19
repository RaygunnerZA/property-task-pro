import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, Box, ClipboardList, Clock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useAssetLinkedTasks } from "@/hooks/useAssetLinkedTasks";
import { useSpaces } from "@/hooks/useSpaces";
import {
  ONBOARDING_ASSET_GROUPS,
  getAssetGroupById,
  getGroupIdFromAssetType,
  type AssetSuggestionLabelOverrides,
  type OnboardingAssetCustomCollection,
} from "@/components/onboarding/onboardingAssetGroups";
import { DraggableChipShell } from "@/components/onboarding/DraggableChipShell";
import {
  DroppableZone,
  groupDroppableId,
  parseMiniCardGroupDroppableId,
  parseSpaceDroppableId,
  propertyLevelDroppableId,
  spaceDroppableId,
  type OnboardingDragData,
  onboardingDragLabel,
} from "@/components/onboarding/onboardingAreasDnd";
import {
  createPropertyAssetCustomCollection,
  loadPropertyCustomAssetGroups,
  savePropertyCustomAssetGroups,
} from "@/lib/propertyCustomAssetGroupsStorage";
import {
  partitionPropertySpaces,
  spaceAssignmentOptions,
  toOnboardingAreas,
} from "@/lib/spaces/partitionPropertySpaces";
import { getAssetGroupCardIllustration } from "@/lib/assetGroupIllustrations";
import { getAssetIcon } from "@/lib/icon-resolver";
import { CollectionShelf } from "@/components/organise/CollectionShelf";
import {
  CollectionShelfCard,
  NewCollectionShelfCard,
} from "@/components/organise/CollectionShelfCard";
import { OrganiseViewTabs, type OrganiseViewTab } from "@/components/organise/OrganiseViewTabs";
import { OrganiseControlsBar } from "@/components/organise/OrganiseControlsBar";
import { AttentionListView, type AttentionSection } from "@/components/organise/AttentionListView";
import { EntityMiniCard, type MiniCardAction } from "@/components/organise/EntityMiniCard";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FilterGroup, FilterOption } from "@/components/ui/filters/FilterBar";
import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";
import { toast } from "sonner";
import { markQuickWinComplete } from "@/lib/quickWins";
import { invalidateAssetQueries } from "@/lib/invalidateAssetQueries";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const ALL_ASSETS_ILLUSTRATION = "/centre-workbench/assets.png";
const CUSTOM_COLLECTION_COLOR = "#C4A35A";

export type AssetsOrganiseView = "attention" | "spaces" | "category";

const VIEW_TABS: readonly OrganiseViewTab<AssetsOrganiseView>[] = [
  {
    id: "attention",
    label: "Attention",
    subtitle: "Assets with open work or poor condition — tasks grouped by asset.",
  },
  {
    id: "spaces",
    label: "Spaces",
    subtitle: "Assets grouped by the space they live in. Drag a card onto a space to assign it.",
  },
  {
    id: "category",
    label: "Category",
    subtitle:
      "Assets by type. Drag a card onto a category to refile it — or onto another asset to group them.",
  },
] as const;

const FILTER_OPEN_WORK = "filter-asset-open";
const FILTER_CONDITION = "filter-asset-condition";
const FILTER_UNASSIGNED = "filter-asset-unassigned";
const FILTER_SPACE_PREFIX = "filter-asset-space-";

type PropertyAssetGroupCarouselProps = {
  propertyId: string;
  className?: string;
  /** External search (workbench header) — combined with the inline SEARCH field. */
  assetFilter?: string;
  onViewAsset?: (assetId: string) => void;
  view?: AssetsOrganiseView;
  onViewChange?: (view: AssetsOrganiseView) => void;
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

/**
 * Assets centre — organise views (@Docs/04_UI_System.md):
 * Attention | Spaces | Category tabs, the standard [FILTER] [SORT] [SEARCH]
 * controls row, and draggable mini cards (drop on a peer = Group).
 */
export function PropertyAssetGroupCarousel({
  propertyId,
  className,
  assetFilter = "",
  onViewAsset,
  view: viewProp,
  onViewChange,
}: PropertyAssetGroupCarouselProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: assets = [], refetch } = useAssetsQuery(propertyId);
  const { spaces } = useSpaces(propertyId);

  const [internalView, setInternalView] = useState<AssetsOrganiseView>("category");
  const view = viewProp ?? internalView;
  const setView = useCallback(
    (next: AssetsOrganiseView) => {
      setInternalView(next);
      onViewChange?.(next);
    },
    [onViewChange]
  );

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [activeDrag, setActiveDrag] = useState<OnboardingDragData | null>(null);
  const [dragOverLabel, setDragOverLabel] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<WorkbenchSortBy>("title");
  const [search, setSearch] = useState("");
  const [addAssetName, setAddAssetName] = useState("");

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

  const {
    areas: partitionedAreas,
    rooms,
    roomsByAreaId,
  } = useMemo(() => partitionPropertySpaces(spaces), [spaces]);

  const areas = useMemo(
    () => toOnboardingAreas(partitionedAreas),
    [partitionedAreas]
  );

  const spaceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of spaces) {
      map[s.id] = (s.name ?? "").trim() || "Space";
    }
    return map;
  }, [spaces]);

  const spacePickerOptions = useMemo(() => spaceAssignmentOptions(spaces), [spaces]);

  const spaceColorById = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const area of areas) {
      colors[area.id] = area.color;
      for (const room of roomsByAreaId[area.id] ?? []) {
        colors[room.id] = area.color;
      }
    }
    return colors;
  }, [areas, roomsByAreaId]);

  const roomAreaIdBySpaceId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const area of areas) {
      for (const room of roomsByAreaId[area.id] ?? []) {
        map[room.id] = area.id;
      }
    }
    return map;
  }, [areas, roomsByAreaId]);

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  useEffect(() => {
    const places = [...rooms, ...partitionedAreas];
    if (places.length === 0) {
      setActiveSpaceId(null);
      return;
    }
    if (activeSpaceId && places.some((s) => s.id === activeSpaceId)) return;
    const preferred = rooms[0] ?? partitionedAreas[0];
    setActiveSpaceId(preferred?.id ?? null);
  }, [rooms, partitionedAreas, activeSpaceId]);

  const groupIdByAssetId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const asset of assets) {
      if (!asset.id) continue;
      map[asset.id] = resolveAssetGroupId(asset, assetToCollection);
    }
    return map;
  }, [assets, assetToCollection]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of assets) {
      if (!asset.id) continue;
      const groupId = groupIdByAssetId[asset.id];
      if (!groupId) continue;
      counts[groupId] = (counts[groupId] ?? 0) + 1;
    }
    return counts;
  }, [assets, groupIdByAssetId]);

  /* ------------------------- attention (open work) ------------------------ */

  const allAssetIds = useMemo(
    () => assets.filter((a) => a.id).map((a) => a.id!),
    [assets]
  );
  const { data: linkedTaskRows = [] } = useAssetLinkedTasks(allAssetIds);

  const linkedTasksByAssetId = useMemo(() => {
    const map = new Map<string, typeof linkedTaskRows>();
    for (const row of linkedTaskRows) {
      if (!row.assetId) continue;
      const list = map.get(row.assetId) ?? [];
      list.push(row);
      map.set(row.assetId, list);
    }
    return map;
  }, [linkedTaskRows]);

  const assetNeedsAttention = useCallback(
    (asset: AssetViewRow): boolean => {
      if ((asset.status || "active") !== "active") return false;
      const score = asset.condition_score ?? 100;
      const openFromView = asset.open_tasks_count ?? 0;
      const openFromLinks = asset.id
        ? (linkedTasksByAssetId.get(asset.id)?.length ?? 0)
        : 0;
      return score < 60 || openFromView > 0 || openFromLinks > 0;
    },
    [linkedTasksByAssetId]
  );

  /* ------------------------ controls (filter/sort/search) ----------------- */

  const filterPrimaryOptions: FilterOption[] = useMemo(
    () => [
      {
        id: FILTER_OPEN_WORK,
        label: "Open work",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        id: FILTER_CONDITION,
        label: "Poor condition",
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "#EB6834",
      },
      { id: FILTER_UNASSIGNED, label: "Unassigned" },
    ],
    []
  );

  const filterSecondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "spaces",
        label: "Space",
        options: rooms.map((room) => ({
          id: `${FILTER_SPACE_PREFIX}${room.id}`,
          label: (room.name ?? "").trim() || "Space",
        })),
      },
    ],
    [rooms]
  );

  const handleFilterChange = useCallback((filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) next.add(filterId);
      else next.delete(filterId);
      return next;
    });
  }, []);

  const selectedSpaceFilterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of selectedFilters) {
      if (f.startsWith(FILTER_SPACE_PREFIX)) ids.add(f.slice(FILTER_SPACE_PREFIX.length));
    }
    return ids;
  }, [selectedFilters]);

  const effectiveSearch = (search.trim() || assetFilter.trim()).toLowerCase();

  const passesControls = useCallback(
    (asset: AssetViewRow): boolean => {
      if (selectedFilters.has(FILTER_OPEN_WORK) && (asset.open_tasks_count ?? 0) === 0) {
        const linked = asset.id ? (linkedTasksByAssetId.get(asset.id)?.length ?? 0) : 0;
        if (linked === 0) return false;
      }
      if (selectedFilters.has(FILTER_CONDITION) && (asset.condition_score ?? 100) >= 60) {
        return false;
      }
      if (selectedFilters.has(FILTER_UNASSIGNED) && asset.space_id) return false;
      if (selectedSpaceFilterIds.size > 0) {
        if (!asset.space_id || !selectedSpaceFilterIds.has(asset.space_id)) return false;
      }
      if (effectiveSearch) {
        const hay = `${asset.name ?? ""} ${asset.serial_number ?? ""} ${asset.manufacturer ?? ""} ${asset.model ?? ""}`.toLowerCase();
        if (!hay.includes(effectiveSearch)) return false;
      }
      return true;
    },
    [selectedFilters, selectedSpaceFilterIds, effectiveSearch, linkedTasksByAssetId]
  );

  const sortAssets = useCallback(
    (list: AssetViewRow[]): AssetViewRow[] => {
      const sorted = [...list];
      if (sortBy === "recent") {
        sorted.sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        );
      } else if (sortBy === "priority") {
        sorted.sort((a, b) => (b.open_tasks_count ?? 0) - (a.open_tasks_count ?? 0));
      } else {
        sorted.sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
      }
      return sorted;
    },
    [sortBy]
  );

  const visibleAssets = useMemo(() => {
    return sortAssets(
      assets.filter((asset) => {
        if (!asset.id) return false;
        if (
          selectedGroupId !== "all" &&
          groupIdByAssetId[asset.id] !== selectedGroupId
        ) {
          return false;
        }
        return passesControls(asset);
      })
    );
  }, [assets, selectedGroupId, groupIdByAssetId, passesControls, sortAssets]);

  const selectedGroup = getAssetGroupById(selectedGroupId);
  const selectedCollection = customCollections.find((c) => c.id === selectedGroupId);
  const benchTitle =
    selectedGroupId === "all"
      ? "All assets"
      : selectedGroup?.label ?? selectedCollection?.name ?? "Assets";

  const suggestionChips = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.suggestedAssets
      .filter((name) => {
        const key = name.toLowerCase().trim();
        const override = suggestionLabelOverrides[key];
        const effective = (override ?? name).toLowerCase().trim();
        return !selectedAssetsSet.has(effective) && !selectedAssetsSet.has(key);
      })
      .map((name) => ({
        source: name,
        label: suggestionLabelOverrides[name.toLowerCase().trim()] ?? name,
      }));
  }, [selectedGroup, selectedAssetsSet, suggestionLabelOverrides]);

  /* ------------------------------ mutations ------------------------------- */

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
    (assetId: string, name: string) => {
      const groupId = groupIdByAssetId[assetId] ?? "";
      setRenameModal({ assetId, currentName: name, groupId });
      setRenameInput(name);
    },
    [groupIdByAssetId]
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

  const createAsset = async (
    name: string,
    groupId: string,
    spaceId?: string | null
  ) => {
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

    const resolvedSpaceId = spaceId === undefined ? activeSpaceId : spaceId;

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
        space_id: resolvedSpaceId,
      });
      if (error) throw error;
      assignAssetToCollection(trimmed, groupId);
      const celebrated = markQuickWinComplete("asset", propertyId);
      if (!celebrated) toast.success(`Added ${trimmed}`);
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

  const createAssetRef = useRef(createAsset);
  createAssetRef.current = createAsset;

  const moveAssetToSpace = useCallback(
    async (assetId: string, spaceId: string | null) => {
      const current = assets.find((a) => a.id === assetId);
      if (current && (current.space_id ?? null) === spaceId) return;
      setBusy(true);
      try {
        const { error } = await supabase
          .from("assets")
          .update({ space_id: spaceId })
          .eq("id", assetId);
        if (error) throw error;
        if (spaceId) setActiveSpaceId(spaceId);
        await invalidateAssets();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to move asset";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [assets, invalidateAssets]
  );

  /** Two-zone Group — dragged + target share a custom collection. */
  const groupAssets = useCallback(
    (draggedName: string, targetAssetId: string) => {
      const target = assets.find((a) => a.id === targetAssetId);
      if (!target) return;
      const targetName = (target.name ?? "").trim();
      if (!targetName || !draggedName.trim()) return;
      const targetGroupId = target.id ? groupIdByAssetId[target.id] : undefined;
      const isCustom = targetGroupId
        ? customCollections.some((c) => c.id === targetGroupId)
        : false;
      let collectionId = isCustom ? targetGroupId! : null;
      if (!collectionId) {
        const collection = createPropertyAssetCustomCollection(`${targetName} group`);
        setCustomCollections((prev) => [...prev, collection]);
        collectionId = collection.id;
        assignAssetToCollection(targetName, collectionId);
      }
      assignAssetToCollection(draggedName, collectionId);
      setSelectedGroupId(collectionId);
      setView("category");
      toast.success(`Grouped with ${targetName}`);
    },
    [assets, groupIdByAssetId, customCollections, assignAssetToCollection, setView]
  );

  /* --------------------------------- DnD ---------------------------------- */

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as OnboardingDragData | undefined;
    setActiveDrag(data ?? null);
    setDragOverLabel(null);
  }, []);

  const draggedAssetId = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.kind === "asset" || activeDrag.kind === "unassigned-asset") {
      return activeDrag.assetId;
    }
    return null;
  }, [activeDrag]);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over ? String(event.over.id) : null;
      const drag = activeDrag;
      if (!overId || !drag) {
        setDragOverLabel(null);
        return;
      }
      const spaceId = parseSpaceDroppableId(overId);
      if (spaceId) {
        const target = spaceNameById[spaceId] ?? "space";
        setDragOverLabel(
          drag.kind === "asset-suggestion" ? `Create in ${target}` : `Assign to ${target}`
        );
        return;
      }
      if (overId === propertyLevelDroppableId()) {
        setDragOverLabel(drag.kind === "asset-suggestion" ? null : "Unassign from space");
        return;
      }
      if (overId.startsWith("group:")) {
        const groupId = overId.slice("group:".length);
        const label =
          getAssetGroupById(groupId)?.label ??
          customCollections.find((c) => c.id === groupId)?.name ??
          "category";
        setDragOverLabel(
          drag.kind === "asset-suggestion" ? `Create in ${label}` : `Set category: ${label}`
        );
        return;
      }
      const groupTargetId = parseMiniCardGroupDroppableId(overId);
      if (groupTargetId) {
        const name =
          (assets.find((a) => a.id === groupTargetId)?.name ?? "").trim() || "asset";
        setDragOverLabel(`Group with ${name}`);
        return;
      }
      setDragOverLabel(null);
    },
    [activeDrag, spaceNameById, customCollections, assets]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drag = activeDrag;
      setActiveDrag(null);
      setDragOverLabel(null);
      const { over } = event;
      if (!over || !drag) return;
      const overId = String(over.id);

      const isAssetDrag = drag.kind === "asset" || drag.kind === "unassigned-asset";
      const dropSpaceId = parseSpaceDroppableId(overId);

      if (isAssetDrag) {
        if (dropSpaceId) {
          void moveAssetToSpace(drag.assetId, dropSpaceId);
          return;
        }
        if (overId === propertyLevelDroppableId()) {
          void moveAssetToSpace(drag.assetId, null);
          return;
        }
        if (overId.startsWith("group:")) {
          const groupId = overId.slice("group:".length);
          assignAssetToCollection(drag.assetName, groupId);
          const label =
            getAssetGroupById(groupId)?.label ??
            customCollections.find((c) => c.id === groupId)?.name ??
            "category";
          toast.success(`${drag.assetName} filed under ${label}`);
          return;
        }
        const groupTargetId = parseMiniCardGroupDroppableId(overId);
        if (groupTargetId && groupTargetId !== drag.assetId) {
          groupAssets(drag.assetName, groupTargetId);
        }
        return;
      }

      if (drag.kind === "asset-suggestion") {
        if (dropSpaceId) {
          void createAssetRef.current(drag.assetName, drag.groupId, dropSpaceId);
          return;
        }
        if (overId.startsWith("group:")) {
          void createAssetRef.current(drag.assetName, overId.slice("group:".length));
        }
      }
    },
    [activeDrag, moveAssetToSpace, assignAssetToCollection, groupAssets, customCollections]
  );

  const removeAssetById = async (assetId: string, name: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("assets").delete().eq("id", assetId);
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
    setSelectedGroupId(collection.id);
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

  const handleAddFromInput = () => {
    const trimmed = addAssetName.trim();
    if (!trimmed) return;
    const groupId =
      selectedGroupId !== "all" ? selectedGroupId : ONBOARDING_ASSET_GROUPS[0].id;
    void createAsset(trimmed, groupId);
    setAddAssetName("");
  };

  /* ------------------------------- rendering ------------------------------- */

  const isAssetDragActive =
    activeDrag != null &&
    (activeDrag.kind === "asset" || activeDrag.kind === "unassigned-asset");

  const renderAssetMiniCard = (asset: AssetViewRow, metaMode: "space" | "category") => {
    const assetId = asset.id!;
    const name = (asset.name ?? "").trim() || "Asset";
    const groupId = groupIdByAssetId[assetId];
    const group = groupId ? getAssetGroupById(groupId) : undefined;
    const collection = groupId
      ? customCollections.find((c) => c.id === groupId)
      : undefined;
    const spaceName = asset.space_id ? spaceNameById[asset.space_id] : undefined;
    const openCount = asset.open_tasks_count ?? 0;
    const Icon = getAssetIcon(asset.icon_name);
    const dragData: OnboardingDragData = asset.space_id
      ? { kind: "asset", assetId, assetName: name, spaceId: asset.space_id }
      : { kind: "unassigned-asset", assetId, assetName: name };
    const actions: MiniCardAction[] = [
      { label: "Open", onClick: () => onViewAsset?.(assetId) },
      { label: "Rename", onClick: () => openRenameModal(assetId, name) },
      {
        label: "Duplicate",
        onClick: () => {
          const gid = groupId ?? ONBOARDING_ASSET_GROUPS[0].id;
          const suggested = getSuggestedCopyName(name);
          setCopyModal({ baseName: name, suggestedName: suggested, groupId: gid });
          setCopyInput(suggested);
        },
      },
      {
        id: "add-to-space",
        label: "Add to Space",
        submenu: [
          {
            id: "space-none",
            label: "None",
            checked: !asset.space_id,
            onClick: () => void moveAssetToSpace(assetId, null),
          },
          ...spacePickerOptions.map((space) => ({
            id: space.id,
            label: space.label,
            checked: asset.space_id === space.id,
            onClick: () => void moveAssetToSpace(assetId, space.id),
          })),
        ],
      },
      ...(asset.space_id
        ? [
            {
              label: "View space",
              onClick: () =>
                navigate(`/properties/${propertyId}/spaces/${asset.space_id}`),
            },
          ]
        : []),
      {
        label: "Remove",
        destructive: true,
        onClick: () => void removeAssetById(assetId, name),
      },
    ];
    return (
      <EntityMiniCard
        key={assetId}
        entityId={assetId}
        title={name}
        meta={
          metaMode === "space"
            ? group?.label ?? collection?.name ?? "Asset"
            : spaceName ?? "Unassigned"
        }
        icon={<Icon className="h-7 w-7" aria-hidden />}
        accentColor={
          metaMode === "space"
            ? group?.color
            : asset.space_id
              ? spaceColorById[asset.space_id]
              : undefined
        }
        badge={
          openCount > 0 ? (
            <span className="rounded-md bg-card/90 px-1.5 py-0.5 font-mono text-2xs font-semibold text-foreground shadow-e1">
              {openCount}
            </span>
          ) : null
        }
        dragId={`minicard-asset:${assetId}`}
        dragData={dragData}
        onOpen={() => onViewAsset?.(assetId)}
        dropCandidate={isAssetDragActive && draggedAssetId !== assetId}
        subZone={false}
        groupZoneLabel="Group"
        actions={actions}
      />
    );
  };

  const attentionSections: AttentionSection[] = useMemo(() => {
    const entries = assets.filter(
      (a) => a.id && assetNeedsAttention(a) && passesControls(a)
    );
    const sorted =
      sortBy === "title"
        ? sortAssets(entries)
        : [...entries].sort(
            (a, b) => (b.open_tasks_count ?? 0) - (a.open_tasks_count ?? 0)
          );
    return sorted.map((asset) => {
      const assetId = asset.id!;
      const name = (asset.name ?? "").trim() || "Asset";
      const spaceName = asset.space_id ? spaceNameById[asset.space_id] : undefined;
      const rows = linkedTasksByAssetId.get(assetId) ?? [];
      const Icon = getAssetIcon(asset.icon_name);
      const score = asset.condition_score ?? 100;
      const openCount = asset.open_tasks_count ?? 0;
      return {
        id: assetId,
        title: name,
        subtitle: spaceName ?? "Unassigned",
        iconSrc: rows[0]?.assetImageUrl ?? null,
        icon: <Icon className="h-5 w-5" aria-hidden />,
        accentColor: asset.space_id ? spaceColorById[asset.space_id] : undefined,
        onOpen: () => onViewAsset?.(assetId),
        content: (
          <div className="space-y-2">
            {score < 60 ? (
              <div className="flex items-center gap-2 rounded-[10px] bg-card px-3 py-2 text-xs shadow-e1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden />
                <span className="text-foreground/90">
                  Condition {score}/100 — inspection recommended.
                </span>
              </div>
            ) : null}
            {rows.map((row) => (
              <button
                key={row.taskId}
                type="button"
                onClick={() => navigate(`/task/${row.taskId}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[10px] bg-card px-3 py-2.5 text-left shadow-e1",
                  "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {row.taskTitle}
                </span>
                {row.dueDate ? (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    {format(new Date(row.dueDate), "d MMM")}
                  </span>
                ) : null}
              </button>
            ))}
            {rows.length === 0 && openCount > 0 ? (
              <button
                type="button"
                onClick={() => onViewAsset?.(assetId)}
                className="rounded-[10px] bg-card px-3 py-2 text-left text-xs text-muted-foreground shadow-e1 hover:shadow-md"
              >
                {openCount} open task{openCount === 1 ? "" : "s"} — open the asset for details.
              </button>
            ) : null}
          </div>
        ),
      };
    });
  }, [
    assets,
    assetNeedsAttention,
    passesControls,
    sortBy,
    sortAssets,
    spaceNameById,
    spaceColorById,
    linkedTasksByAssetId,
    onViewAsset,
    navigate,
  ]);

  const shelfCards = (
    <CollectionShelf prevLabel="Previous groups" nextLabel="Next groups">
      <CollectionShelfCard
        label="All assets"
        description="Every maintainable item on this property."
        imageSrc={ALL_ASSETS_ILLUSTRATION}
        color={CUSTOM_COLLECTION_COLOR}
        count={assets.length}
        countNoun="asset"
        selected={selectedGroupId === "all"}
        onSelect={() => setSelectedGroupId("all")}
      />
      {ONBOARDING_ASSET_GROUPS.map((group) => (
        <DroppableZone key={group.id} id={groupDroppableId(group.id)} className="shrink-0">
          <CollectionShelfCard
            label={group.label}
            description={group.description}
            imageSrc={getAssetGroupCardIllustration(group.id) ?? ALL_ASSETS_ILLUSTRATION}
            color={group.color}
            count={groupCounts[group.id] ?? 0}
            countNoun="asset"
            selected={selectedGroupId === group.id}
            onSelect={() => setSelectedGroupId(group.id)}
          />
        </DroppableZone>
      ))}
      {customCollections.map((collection) => (
        <DroppableZone
          key={collection.id}
          id={groupDroppableId(collection.id)}
          className="shrink-0"
        >
          <CollectionShelfCard
            label={collection.name}
            description="Custom collection."
            imageSrc={
              collection.imageSrc ??
              getAssetGroupCardIllustration("custom") ??
              ALL_ASSETS_ILLUSTRATION
            }
            color={CUSTOM_COLLECTION_COLOR}
            count={groupCounts[collection.id] ?? 0}
            countNoun="asset"
            selected={selectedGroupId === collection.id}
            onSelect={() => setSelectedGroupId(collection.id)}
          />
        </DroppableZone>
      ))}
      <NewCollectionShelfCard
        placeholder="e.g. Pool equipment"
        onCreate={handleCreateCustomCollection}
      />
    </CollectionShelf>
  );

  const addAssetInput = (
    <div className="flex items-center gap-1.5">
      <Input
        value={addAssetName}
        onChange={(e) => setAddAssetName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAddFromInput();
          }
        }}
        placeholder="Add asset"
        className="h-8 w-[150px] border-0 bg-background/80 text-sm shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
        aria-label="Add asset"
      />
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1"
        disabled={!addAssetName.trim() || busy}
        onClick={handleAddFromInput}
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  );

  const categoryView = (
    <div className="flex min-h-0 flex-col gap-4">
      {shelfCards}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="mb-3 space-y-2.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">{benchTitle}</h2>
              <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {visibleAssets.length} asset{visibleAssets.length === 1 ? "" : "s"}
              </p>
            </div>
            {addAssetInput}
          </div>

          {suggestionChips.length > 0 && selectedGroup ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                Suggested:
              </span>
              {suggestionChips.map((s) => (
                <DraggableChipShell
                  key={s.source}
                  id={`asset-suggestion:${selectedGroup.id}:${s.source.toLowerCase().trim()}`}
                  data={{
                    kind: "asset-suggestion",
                    assetName: s.label,
                    groupId: selectedGroup.id,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void createAsset(s.label, selectedGroup.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-[8px] bg-background px-2 py-1",
                      "font-mono text-2xs uppercase tracking-wide text-foreground/80 shadow-e1",
                      "hover:text-foreground hover:shadow-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    )}
                  >
                    <Plus className="h-3 w-3 opacity-60" />
                    {s.label}
                  </button>
                </DraggableChipShell>
              ))}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <p className="text-sm text-foreground/90">
                {selectedGroupId === "all" && selectedFilters.size === 0 && !effectiveSearch
                  ? "No assets yet — add one above, or pick a suggestion from a group."
                  : `No ${selectedGroupId === "all" ? "assets" : `${benchTitle} assets`} match the current filters.`}
              </p>
              {selectedGroupId !== "all" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedGroupId("all")}
                >
                  Show all assets
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 pb-4">
              {visibleAssets.map((asset) => renderAssetMiniCard(asset, "space"))}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const assetsBySpaceId = useMemo(() => {
    const map = new Map<string, AssetViewRow[]>();
    for (const asset of visibleAssets) {
      const key = asset.space_id ?? "__unassigned__";
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return map;
  }, [visibleAssets]);

  const spacesView = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {rooms.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add rooms on the Spaces screen to organise assets by place.
        </p>
      ) : (
        rooms.map((room) => {
          const roomAssets = assetsBySpaceId.get(room.id) ?? [];
          const areaId = roomAreaIdBySpaceId[room.id];
          const area = areaId ? areaById.get(areaId) : undefined;
          return (
            <div key={room.id} className="min-w-0">
              <DroppableZone
                id={spaceDroppableId(room.id)}
                className="rounded-[10px]"
                activeClassName="ring-2 ring-primary/50 bg-primary/10"
              >
                <div className="flex items-center gap-2 rounded-[10px] px-1.5 py-1">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: area?.color ?? "#C4C4C4" }}
                    aria-hidden
                  />
                  <h3 className="text-sm font-semibold text-foreground">
                    {(room.name ?? "").trim() || "Space"}
                  </h3>
                  {area ? (
                    <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                      {area.name}
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                    {roomAssets.length}
                  </span>
                </div>
              </DroppableZone>
              {roomAssets.length > 0 ? (
                <div className="grid grid-cols-5 gap-2 px-0.5 pt-2">
                  {roomAssets.map((asset) => renderAssetMiniCard(asset, "category"))}
                </div>
              ) : (
                <p className="px-1.5 pt-1 text-2xs text-muted-foreground/70">
                  Drop assets here to assign them to {(room.name ?? "").trim() || "this space"}.
                </p>
              )}
              <div className="mt-3 border-t border-dashed border-border/45" aria-hidden />
            </div>
          );
        })
      )}

      <div className="min-w-0">
        <DroppableZone
          id={propertyLevelDroppableId()}
          className="rounded-[10px]"
          activeClassName="ring-2 ring-primary/50 bg-primary/10"
        >
          <div className="flex items-center gap-2 rounded-[10px] px-1.5 py-1">
            <Box className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Unassigned</h3>
            <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              {(assetsBySpaceId.get("__unassigned__") ?? []).length}
            </span>
          </div>
        </DroppableZone>
        {(assetsBySpaceId.get("__unassigned__") ?? []).length > 0 ? (
          <div className="grid grid-cols-5 gap-2 px-0.5 pt-2">
            {(assetsBySpaceId.get("__unassigned__") ?? []).map((asset) =>
              renderAssetMiniCard(asset, "category")
            )}
          </div>
        ) : (
          <p className="px-1.5 pt-1 text-2xs text-muted-foreground/70">
            Drop an asset here to unassign it from its space.
          </p>
        )}
      </div>

      <div className="mt-1">{addAssetInput}</div>
    </section>
  );

  const attentionView = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AttentionListView
        sections={attentionSections}
        emptyState={
          <span>
            No assets need attention
            {selectedFilters.size > 0 || effectiveSearch ? " with the current filters" : ""}.
          </span>
        }
      />
    </section>
  );

  return (
    <>
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setDragOverLabel(null);
        }}
      >
        <div className={cn("flex min-h-[420px] flex-col gap-4", className)}>
          <OrganiseViewTabs
            tabs={VIEW_TABS}
            active={view}
            onChange={setView}
            ariaLabel="Assets views"
          />

          <OrganiseControlsBar
            primaryOptions={filterPrimaryOptions}
            secondaryGroups={filterSecondaryGroups}
            selectedFilters={selectedFilters}
            onFilterChange={handleFilterChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search assets"
          />

          {view === "attention" ? attentionView : view === "spaces" ? spacesView : categoryView}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="rounded-[10px] bg-card px-3 py-2 text-sm font-medium shadow-md ring-2 ring-primary/50">
              {dragOverLabel ?? onboardingDragLabel(activeDrag)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
