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
import { AlertTriangle, Box, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSpacesWithTypes, type SpaceWithType } from "@/hooks/useSpacesWithTypes";
import {
  ONBOARDING_SPACE_GROUPS,
  getGroupIdFromDefaultUiGroup,
  getSpaceGroupById,
  inferSpaceGroupIdFromName,
  isCustomCollectionGroupId,
  normalizeSpaceMatchKey,
  shortSpaceLabel,
  type OnboardingCustomCollection,
  type SuggestionLabelOverrides,
} from "@/components/onboarding/onboardingSpaceGroups";
import { type OnboardingArea } from "@/components/onboarding/onboardingPropertyAreas";
import { DraggableChipShell } from "@/components/onboarding/DraggableChipShell";
import {
  DroppableZone,
  areaDroppableId,
  groupDroppableId,
  miniCardGroupDroppableId,
  miniCardSubDroppableId,
  parseMiniCardGroupDroppableId,
  parseMiniCardSubDroppableId,
  propertyLevelDroppableId,
  type OnboardingDragData,
  onboardingDragLabel,
} from "@/components/onboarding/onboardingAreasDnd";
import {
  createPropertyCustomCollection,
  loadPropertyCustomSpaceGroups,
  savePropertyCustomSpaceGroups,
} from "@/lib/propertyCustomSpaceGroupsStorage";
import {
  partitionPropertySpaces,
  toOnboardingAreas,
} from "@/lib/spaces/partitionPropertySpaces";
import { getSpaceGroupCardIllustration } from "@/lib/spaceGroupIllustrations";
import { CollectionShelf } from "@/components/organise/CollectionShelf";
import {
  CollectionShelfCard,
  NewCollectionShelfCard,
} from "@/components/organise/CollectionShelfCard";
import { OrganiseViewTabs, type OrganiseViewTab } from "@/components/organise/OrganiseViewTabs";
import { OrganiseControlsBar } from "@/components/organise/OrganiseControlsBar";
import { AttentionListView, type AttentionSection } from "@/components/organise/AttentionListView";
import { EntityMiniCard, type MiniCardAction } from "@/components/organise/EntityMiniCard";
import TaskCard from "@/components/TaskCard";
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
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { isFuzzyMatchSimilarity } from "@/services/ai/fuzzyMatch";
import { resolveSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";
import { cn } from "@/lib/utils";

const ALL_SPACES_ILLUSTRATION = "/centre-workbench/spaces.png";
const CUSTOM_COLLECTION_COLOR = "#C4A35A";

export type SpacesOrganiseView = "attention" | "areas" | "category";

const VIEW_TABS: readonly OrganiseViewTab<SpacesOrganiseView>[] = [
  {
    id: "attention",
    label: "Attention",
    subtitle: "Spaces with open work — tasks grouped by space, most loaded first.",
  },
  {
    id: "areas",
    label: "Areas",
    subtitle: "Rooms grouped by floor or zone. Drag a card onto an area to move it.",
  },
  {
    id: "category",
    label: "Category",
    subtitle:
      "Spaces by type. Drag a card onto a category to refile it — or onto another space to group or nest.",
  },
] as const;

const FILTER_OPEN_WORK = "filter-space-open";
const FILTER_URGENT = "filter-space-urgent";
const FILTER_UNASSIGNED = "filter-space-unassigned";
const FILTER_AREA_PREFIX = "filter-space-area-";

type PropertySpaceGroupCarouselProps = {
  propertyId: string;
  className?: string;
  /** External search (workbench header) — combined with the inline SEARCH field. */
  spaceFilter?: string;
  /** Open space/area detail in the parent surface (panel / modal). */
  onViewSpace?: (spaceId: string) => void;
  /** Parsed tasks (spaces arrays hydrated) for the Attention view. */
  tasks?: any[];
  view?: SpacesOrganiseView;
  onViewChange?: (view: SpacesOrganiseView) => void;
};

function resolveSpaceGroupId(
  space: SpaceWithType,
  spaceToCollection: Record<string, string>
): string | undefined {
  const nameKey = (space.name ?? "").toLowerCase().trim();
  if (nameKey && spaceToCollection[nameKey]) {
    return spaceToCollection[nameKey];
  }
  const defaultUiGroup = space.space_types?.default_ui_group;
  if (defaultUiGroup) {
    const fromType = getGroupIdFromDefaultUiGroup(defaultUiGroup);
    if (fromType) return fromType;
  }
  return inferSpaceGroupIdFromName(space.name ?? "");
}

function isSuggestionForGroup(name: string, groupId: string): boolean {
  const group = getSpaceGroupById(groupId);
  if (!group) return false;
  const key = normalizeSpaceMatchKey(name);
  return group.suggestedSpaces.some((s) => normalizeSpaceMatchKey(s) === key);
}

function spaceThumb(space: SpaceWithType): string {
  const stored = (space as { thumbnail_url?: string | null }).thumbnail_url;
  if (typeof stored === "string" && stored.trim()) return stored;
  return resolveSpaceMiniCardIllustration((space.name ?? "").trim() || "Space");
}

/**
 * Spaces centre — organise views (@Docs/04_UI_System.md):
 * Attention | Areas | Category tabs, the standard [FILTER] [SORT] [SEARCH]
 * controls row, and draggable mini cards with the Group / Add sub space
 * two-zone gesture.
 */
export function PropertySpaceGroupCarousel({
  propertyId,
  className,
  spaceFilter = "",
  onViewSpace,
  tasks = [],
  view: viewProp,
  onViewChange,
}: PropertySpaceGroupCarouselProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { spaces, refresh } = useSpacesWithTypes(propertyId);

  const [internalView, setInternalView] = useState<SpacesOrganiseView>("category");
  const view = viewProp ?? internalView;
  const setView = useCallback(
    (next: SpacesOrganiseView) => {
      setInternalView(next);
      onViewChange?.(next);
    },
    [onViewChange]
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<WorkbenchSortBy>("title");
  const [search, setSearch] = useState("");
  const [dragOverLabel, setDragOverLabel] = useState<string | null>(null);
  const [addSpaceName, setAddSpaceName] = useState("");

  const [renameModal, setRenameModal] = useState<{
    spaceId: string;
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
  const [customCollections, setCustomCollections] = useState<OnboardingCustomCollection[]>([]);
  const [spaceToCollection, setSpaceToCollection] = useState<Record<string, string>>({});
  const [suggestionLabelOverrides, setSuggestionLabelOverrides] =
    useState<SuggestionLabelOverrides>({});
  /** Optimistic newest-first pins so cards appear before refetch settles. */
  const [pendingPinsByGroup, setPendingPinsByGroup] = useState<Record<string, string[]>>({});
  const skipPersistCustomGroupsRef = useRef(true);

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<OnboardingDragData | null>(null);
  const [renameAreaModal, setRenameAreaModal] = useState<{
    areaId: string;
    name: string;
  } | null>(null);
  const [renameAreaInput, setRenameAreaInput] = useState("");
  const [areaDeleteModal, setAreaDeleteModal] = useState<{
    areaId: string;
    spaceCount: number;
  } | null>(null);
  const [transferTargetAreaId, setTransferTargetAreaId] = useState("");
  const [addAreaName, setAddAreaName] = useState("");

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const {
    areas: partitionedAreas,
    rooms,
    roomsByAreaId,
    unassigned,
  } = useMemo(() => partitionPropertySpaces(spaces), [spaces]);

  const areas: OnboardingArea[] = useMemo(
    () => toOnboardingAreas(partitionedAreas),
    [partitionedAreas]
  );

  const areaIdSet = useMemo(
    () => new Set(partitionedAreas.map((a) => a.id)),
    [partitionedAreas]
  );

  /** Sub-spaces — nested under a room (not an area). Shown as mini-card chips. */
  const subSpacesByParentId = useMemo(() => {
    const map: Record<string, SpaceWithType[]> = {};
    for (const space of spaces) {
      const parentId =
        typeof space.parent_space_id === "string" ? space.parent_space_id : null;
      if (!parentId || areaIdSet.has(parentId)) continue;
      (map[parentId] ??= []).push(space);
    }
    return map;
  }, [spaces, areaIdSet]);

  const subSpaceIds = useMemo(() => {
    const set = new Set<string>();
    for (const list of Object.values(subSpacesByParentId)) {
      for (const s of list) set.add(s.id);
    }
    return set;
  }, [subSpacesByParentId]);

  /** Every top-level space on the property (nested rooms + unassigned, minus sub-spaces). */
  const benchSpaces = useMemo(
    () => [...rooms, ...unassigned].filter((s) => !subSpaceIds.has(s.id)),
    [rooms, unassigned, subSpaceIds]
  );

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null;

  useEffect(() => {
    if (areas.length === 0) {
      setActiveAreaId(null);
      return;
    }
    if (activeAreaId && areas.some((a) => a.id === activeAreaId)) return;
    setActiveAreaId(areas[0].id);
  }, [areas, activeAreaId]);

  useEffect(() => {
    skipPersistCustomGroupsRef.current = true;
    const stored = loadPropertyCustomSpaceGroups(propertyId);
    setCustomCollections(stored.collections);
    setSpaceToCollection(stored.spaceToCollection);
    setSuggestionLabelOverrides(stored.suggestionLabelOverrides);
    queueMicrotask(() => {
      skipPersistCustomGroupsRef.current = false;
    });
  }, [propertyId]);

  useEffect(() => {
    if (skipPersistCustomGroupsRef.current) return;
    savePropertyCustomSpaceGroups(propertyId, {
      collections: customCollections,
      spaceToCollection,
      suggestionLabelOverrides,
    });
  }, [propertyId, customCollections, spaceToCollection, suggestionLabelOverrides]);

  const assignSpaceToCollection = useCallback((name: string, collectionId: string) => {
    const key = name.toLowerCase().trim();
    setSpaceToCollection((prev) => ({ ...prev, [key]: collectionId }));
  }, []);

  const unassignSpace = useCallback((name: string) => {
    const key = name.toLowerCase().trim();
    setSpaceToCollection((prev) => {
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
      const next: SuggestionLabelOverrides = { ...prev };
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

  const selectedSpacesSet = useMemo(() => {
    const set = new Set(
      benchSpaces.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
    );
    for (const pins of Object.values(pendingPinsByGroup)) {
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (key) set.add(key);
      }
    }
    return set;
  }, [benchSpaces, pendingPinsByGroup]);

  useEffect(() => {
    const existing = new Set(
      benchSpaces.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
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
  }, [benchSpaces]);

  const pinSpaceOptimistic = useCallback((name: string, groupId: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    setPendingPinsByGroup((prev) => {
      const existing = (prev[groupId] ?? []).filter((n) => n.toLowerCase().trim() !== key);
      return { ...prev, [groupId]: [trimmed, ...existing] };
    });
  }, []);

  const groupIdBySpaceId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const space of benchSpaces) {
      map[space.id] = resolveSpaceGroupId(space, spaceToCollection);
    }
    return map;
  }, [benchSpaces, spaceToCollection]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const space of benchSpaces) {
      const groupId = groupIdBySpaceId[space.id];
      if (!groupId) continue;
      counts[groupId] = (counts[groupId] ?? 0) + 1;
    }
    return counts;
  }, [benchSpaces, groupIdBySpaceId]);

  /* ------------------------- attention (open work) ------------------------ */

  const openTasksBySpaceId = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const task of tasks) {
      if (task.status === "completed" || task.status === "archived") continue;
      const linked = Array.isArray(task.spaces) ? task.spaces : [];
      for (const s of linked) {
        if (!s?.id) continue;
        const list = map.get(s.id) ?? [];
        list.push(task);
        map.set(s.id, list);
      }
    }
    return map;
  }, [tasks]);

  const urgentSpaceIds = useMemo(() => {
    const set = new Set<string>();
    for (const [spaceId, list] of openTasksBySpaceId) {
      const hot = list.some((t) => {
        const pr = String(t.priority ?? "").toLowerCase();
        return pr === "urgent" || pr === "high";
      });
      if (hot) set.add(spaceId);
    }
    return set;
  }, [openTasksBySpaceId]);

  /* ------------------------ controls (filter/sort/search) ----------------- */

  const filterPrimaryOptions: FilterOption[] = useMemo(
    () => [
      {
        id: FILTER_OPEN_WORK,
        label: "Open work",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        id: FILTER_URGENT,
        label: "Urgent",
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
        id: "areas",
        label: "Area",
        options: areas.map((a) => ({
          id: `${FILTER_AREA_PREFIX}${a.id}`,
          label: a.name,
        })),
      },
    ],
    [areas]
  );

  const handleFilterChange = useCallback((filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) next.add(filterId);
      else next.delete(filterId);
      return next;
    });
  }, []);

  const selectedAreaFilterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of selectedFilters) {
      if (f.startsWith(FILTER_AREA_PREFIX)) ids.add(f.slice(FILTER_AREA_PREFIX.length));
    }
    return ids;
  }, [selectedFilters]);

  const effectiveSearch = (search.trim() || spaceFilter.trim()).toLowerCase();

  const passesControls = useCallback(
    (space: SpaceWithType): boolean => {
      if (selectedFilters.has(FILTER_OPEN_WORK) && !(openTasksBySpaceId.get(space.id)?.length)) {
        return false;
      }
      if (selectedFilters.has(FILTER_URGENT) && !urgentSpaceIds.has(space.id)) return false;
      const parentAreaId =
        typeof space.parent_space_id === "string" ? space.parent_space_id : null;
      if (selectedFilters.has(FILTER_UNASSIGNED) && parentAreaId) return false;
      if (selectedAreaFilterIds.size > 0) {
        if (!parentAreaId || !selectedAreaFilterIds.has(parentAreaId)) return false;
      }
      if (effectiveSearch && !(space.name ?? "").toLowerCase().includes(effectiveSearch)) {
        return false;
      }
      return true;
    },
    [selectedFilters, selectedAreaFilterIds, openTasksBySpaceId, urgentSpaceIds, effectiveSearch]
  );

  const sortSpaces = useCallback(
    (list: SpaceWithType[]): SpaceWithType[] => {
      const sorted = [...list];
      if (sortBy === "recent") {
        sorted.sort(
          (a, b) =>
            new Date((b as { created_at?: string }).created_at ?? 0).getTime() -
            new Date((a as { created_at?: string }).created_at ?? 0).getTime()
        );
      } else if (sortBy === "priority") {
        sorted.sort(
          (a, b) =>
            (openTasksBySpaceId.get(b.id)?.length ?? 0) -
            (openTasksBySpaceId.get(a.id)?.length ?? 0)
        );
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
    [sortBy, openTasksBySpaceId]
  );

  const visibleSpaces = useMemo(() => {
    return sortSpaces(
      benchSpaces.filter((space) => {
        if (selectedGroupId !== "all" && groupIdBySpaceId[space.id] !== selectedGroupId) {
          return false;
        }
        return passesControls(space);
      })
    );
  }, [benchSpaces, selectedGroupId, groupIdBySpaceId, passesControls, sortSpaces]);

  const selectedGroup = getSpaceGroupById(selectedGroupId);
  const selectedCollection = customCollections.find((c) => c.id === selectedGroupId);
  const benchTitle =
    selectedGroupId === "all"
      ? "All spaces"
      : selectedGroup?.label ?? selectedCollection?.name ?? "Spaces";

  const suggestionChips = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.suggestedSpaces
      .filter((name) => {
        const key = normalizeSpaceMatchKey(name);
        const override = suggestionLabelOverrides[name.toLowerCase().trim()];
        const effective = (override ?? name).toLowerCase().trim();
        return !selectedSpacesSet.has(effective) && !selectedSpacesSet.has(key);
      })
      .map((name) => ({
        source: name,
        label: suggestionLabelOverrides[name.toLowerCase().trim()] ?? name,
      }));
  }, [selectedGroup, selectedSpacesSet, suggestionLabelOverrides]);

  /* ------------------------------ mutations ------------------------------- */

  const invalidateSpaces = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["spaces"] });
    await refresh();
  }, [queryClient, refresh]);

  const findSpaceByName = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      return benchSpaces.find((s) => (s.name ?? "").toLowerCase().trim() === key);
    },
    [benchSpaces]
  );

  const setSpaceParent = useCallback(
    async (spaceId: string, parentSpaceId: string | null) => {
      const { error } = await supabase
        .from("spaces")
        .update({ parent_space_id: parentSpaceId })
        .eq("id", spaceId);
      if (error) throw error;
      await invalidateSpaces();
    },
    [invalidateSpaces]
  );

  const handleAddArea = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (!orgId) {
        toast.error("Organisation not found");
        return;
      }
      const key = trimmed.toLowerCase();
      const existingArea = areas.find((a) => a.name.toLowerCase() === key);
      if (existingArea) {
        setActiveAreaId(existingArea.id);
        return;
      }
      const existingSpace = spaces.find(
        (s) => (s.name ?? "").toLowerCase().trim() === key
      );
      if (existingSpace) {
        if (existingSpace.parent_space_id) {
          toast.error("A space with that name already exists in an area");
          return;
        }
        setActiveAreaId(existingSpace.id);
        toast.success(`Using ${trimmed} as an area`);
        await invalidateSpaces();
        return;
      }
      setBusy(true);
      try {
        const { data, error } = await supabase
          .from("spaces")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            name: trimmed,
            floor_level: trimmed,
            parent_space_id: null,
            icon_name: "layers",
            thumbnail_url: resolveSpaceMiniCardIllustration(trimmed),
          })
          .select("id")
          .single();
        if (error) throw error;
        setActiveAreaId(data.id as string);
        toast.success(`Added area ${trimmed}`);
        await invalidateSpaces();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to add area";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [areas, spaces, orgId, propertyId, invalidateSpaces]
  );

  const purgeArea = useCallback(
    async (areaId: string, deleteChildren: boolean) => {
      setBusy(true);
      try {
        const childIds = (roomsByAreaId[areaId] ?? []).map((s) => s.id);
        if (deleteChildren && childIds.length) {
          const { error } = await supabase.from("spaces").delete().in("id", childIds);
          if (error) throw error;
          for (const room of roomsByAreaId[areaId] ?? []) {
            const name = room.name ?? "";
            if (name) {
              unassignSpace(name);
              clearSuggestionOverridesForName(name);
            }
          }
        } else if (childIds.length) {
          const { error } = await supabase
            .from("spaces")
            .update({ parent_space_id: null })
            .in("id", childIds);
          if (error) throw error;
        }
        const { error } = await supabase.from("spaces").delete().eq("id", areaId);
        if (error) throw error;
        setActiveAreaId((prev) => {
          if (prev !== areaId) return prev;
          return areas.find((a) => a.id !== areaId)?.id ?? null;
        });
        setSelectedFilters((prev) => {
          const filterId = `${FILTER_AREA_PREFIX}${areaId}`;
          if (!prev.has(filterId)) return prev;
          const next = new Set(prev);
          next.delete(filterId);
          return next;
        });
        toast.success("Area removed");
        await invalidateSpaces();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to remove area";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [
      roomsByAreaId,
      areas,
      unassignSpace,
      clearSuggestionOverridesForName,
      invalidateSpaces,
    ]
  );

  const handleRemoveArea = useCallback(
    (areaId: string) => {
      const count = (roomsByAreaId[areaId] ?? []).length;
      if (count > 5) {
        setAreaDeleteModal({ areaId, spaceCount: count });
        setTransferTargetAreaId(areas.find((a) => a.id !== areaId)?.id ?? "");
        return;
      }
      void purgeArea(areaId, true);
    },
    [roomsByAreaId, areas, purgeArea]
  );

  const confirmDeleteArea = useCallback(
    async (mode: "delete" | "transfer") => {
      if (!areaDeleteModal) return;
      const { areaId } = areaDeleteModal;
      if (mode === "transfer" && transferTargetAreaId && transferTargetAreaId !== areaId) {
        setBusy(true);
        try {
          const childIds = (roomsByAreaId[areaId] ?? []).map((s) => s.id);
          if (childIds.length) {
            const { error } = await supabase
              .from("spaces")
              .update({ parent_space_id: transferTargetAreaId })
              .in("id", childIds);
            if (error) throw error;
          }
          const { error } = await supabase.from("spaces").delete().eq("id", areaId);
          if (error) throw error;
          setActiveAreaId(transferTargetAreaId);
          toast.success("Spaces transferred");
          await invalidateSpaces();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to transfer spaces";
          toast.error(message);
        } finally {
          setBusy(false);
        }
      } else {
        await purgeArea(areaId, true);
      }
      setAreaDeleteModal(null);
      setTransferTargetAreaId("");
    },
    [
      areaDeleteModal,
      transferTargetAreaId,
      roomsByAreaId,
      purgeArea,
      invalidateSpaces,
    ]
  );

  const openRenameArea = useCallback(
    (areaId: string) => {
      const area = areas.find((a) => a.id === areaId);
      if (!area) return;
      setRenameAreaModal({ areaId, name: area.name });
      setRenameAreaInput(area.name);
    },
    [areas]
  );

  const confirmRenameArea = useCallback(async () => {
    if (!renameAreaModal) return;
    const trimmed = renameAreaInput.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (areas.some((a) => a.id !== renameAreaModal.areaId && a.name.toLowerCase() === key)) {
      toast.error("Area already exists");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: trimmed, floor_level: trimmed })
        .eq("id", renameAreaModal.areaId);
      if (error) throw error;
      toast.success("Area renamed");
      setRenameAreaModal(null);
      setRenameAreaInput("");
      await invalidateSpaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to rename area";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [renameAreaModal, renameAreaInput, areas, invalidateSpaces]);

  const moveSpaceToArea = useCallback(
    async (spaceId: string, targetAreaId: string | null) => {
      setBusy(true);
      try {
        await setSpaceParent(spaceId, targetAreaId);
        if (targetAreaId) setActiveAreaId(targetAreaId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to move space";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [setSpaceParent]
  );

  /** Two-zone bottom half — nest dragged space under the target room. */
  const nestSpaceUnder = useCallback(
    async (spaceId: string, targetSpaceId: string) => {
      if (spaceId === targetSpaceId) return;
      const target = spaceById.get(targetSpaceId);
      if (!target) return;
      if (
        typeof target.parent_space_id === "string" &&
        target.parent_space_id === spaceId
      ) {
        toast.error("That space is already nested under the one you're dragging");
        return;
      }
      setBusy(true);
      try {
        await setSpaceParent(spaceId, targetSpaceId);
        toast.success(`Added sub space to ${(target.name ?? "").trim() || "space"}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to nest space";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [spaceById, setSpaceParent]
  );

  /** Two-zone top half — group dragged + target into a shared custom collection. */
  const groupSpaces = useCallback(
    (draggedName: string, targetSpaceId: string) => {
      const target = spaceById.get(targetSpaceId);
      if (!target) return;
      const targetName = (target.name ?? "").trim();
      if (!targetName || !draggedName.trim()) return;
      const targetGroupId = groupIdBySpaceId[target.id];
      let collectionId =
        targetGroupId && isCustomCollectionGroupId(targetGroupId) ? targetGroupId : null;
      if (!collectionId) {
        const collection = createPropertyCustomCollection(`${targetName} group`);
        setCustomCollections((prev) => [...prev, collection]);
        collectionId = collection.id;
        assignSpaceToCollection(targetName, collectionId);
      }
      assignSpaceToCollection(draggedName, collectionId);
      setSelectedGroupId(collectionId);
      setView("category");
      toast.success(`Grouped with ${targetName}`);
    },
    [spaceById, groupIdBySpaceId, assignSpaceToCollection, setView]
  );

  const createSpaceRef = useRef<
    (name: string, groupId: string, parentAreaId?: string | null) => Promise<void>
  >(async () => undefined);

  /* --------------------------------- DnD ---------------------------------- */

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as OnboardingDragData | undefined;
    setActiveDrag(data ?? null);
    setDragOverLabel(null);
  }, []);

  const draggedSpaceId = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.kind === "space") return activeDrag.spaceId ?? null;
    if (activeDrag.kind === "unassigned") return activeDrag.spaceId;
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
      if (overId.startsWith("area-drop:")) {
        const areaName = areaById.get(overId.slice("area-drop:".length))?.name ?? "area";
        setDragOverLabel(
          drag.kind === "suggestion" ? `Create in ${areaName}` : `Move to ${areaName}`
        );
        return;
      }
      if (overId === propertyLevelDroppableId()) {
        setDragOverLabel(drag.kind === "suggestion" ? null : "Remove from area");
        return;
      }
      if (overId.startsWith("group:")) {
        const groupId = overId.slice("group:".length);
        const label =
          getSpaceGroupById(groupId)?.label ??
          customCollections.find((c) => c.id === groupId)?.name ??
          "category";
        setDragOverLabel(
          drag.kind === "suggestion" ? `Create in ${label}` : `Set category: ${label}`
        );
        return;
      }
      const groupTargetId = parseMiniCardGroupDroppableId(overId);
      if (groupTargetId) {
        const name = (spaceById.get(groupTargetId)?.name ?? "").trim() || "space";
        setDragOverLabel(`Group with ${name}`);
        return;
      }
      const subTargetId = parseMiniCardSubDroppableId(overId);
      if (subTargetId) {
        const name = (spaceById.get(subTargetId)?.name ?? "").trim() || "space";
        setDragOverLabel(`Add sub space of ${name}`);
        return;
      }
      setDragOverLabel(null);
    },
    [activeDrag, areaById, spaceById, customCollections]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drag = activeDrag;
      setActiveDrag(null);
      setDragOverLabel(null);
      const { over } = event;
      if (!over || !drag) return;
      const overId = String(over.id);

      const resolveSpaceId = (): string | null => {
        if (drag.kind === "space" && drag.spaceId) return drag.spaceId;
        if (drag.kind === "unassigned") return drag.spaceId;
        if (drag.kind === "space") {
          return findSpaceByName(drag.spaceName)?.id ?? null;
        }
        return null;
      };
      const dragName =
        drag.kind === "space" || drag.kind === "unassigned" || drag.kind === "suggestion"
          ? drag.spaceName
          : null;

      if (
        (drag.kind === "space" || drag.kind === "unassigned") &&
        overId.startsWith("area-drop:")
      ) {
        const spaceId = resolveSpaceId();
        const targetAreaId = overId.slice("area-drop:".length);
        if (spaceId) void moveSpaceToArea(spaceId, targetAreaId);
        return;
      }

      if (drag.kind === "space" && overId === propertyLevelDroppableId()) {
        const spaceId = resolveSpaceId();
        if (spaceId) void moveSpaceToArea(spaceId, null);
        return;
      }

      if (overId.startsWith("group:")) {
        const groupId = overId.slice("group:".length);
        if (drag.kind === "suggestion") {
          void createSpaceRef.current(drag.spaceName, groupId);
          return;
        }
        if (dragName) {
          assignSpaceToCollection(dragName, groupId);
          const label =
            getSpaceGroupById(groupId)?.label ??
            customCollections.find((c) => c.id === groupId)?.name ??
            "category";
          toast.success(`${dragName} filed under ${label}`);
        }
        return;
      }

      const groupTargetId = parseMiniCardGroupDroppableId(overId);
      if (groupTargetId && dragName && drag.kind !== "suggestion") {
        if (groupTargetId !== resolveSpaceId()) groupSpaces(dragName, groupTargetId);
        return;
      }

      const subTargetId = parseMiniCardSubDroppableId(overId);
      if (subTargetId && (drag.kind === "space" || drag.kind === "unassigned")) {
        const spaceId = resolveSpaceId();
        if (spaceId) void nestSpaceUnder(spaceId, subTargetId);
        return;
      }

      if (drag.kind === "suggestion" && overId.startsWith("area-drop:")) {
        const targetAreaId = overId.slice("area-drop:".length);
        setActiveAreaId(targetAreaId);
        void createSpaceRef.current(drag.spaceName, drag.groupId, targetAreaId);
      }
    },
    [
      activeDrag,
      findSpaceByName,
      moveSpaceToArea,
      assignSpaceToCollection,
      groupSpaces,
      nestSpaceUnder,
      customCollections,
    ]
  );

  /* ------------------------------ CRUD helpers ----------------------------- */

  const openRenameModal = useCallback(
    (spaceId: string, name: string) => {
      const space = benchSpaces.find((s) => s.id === spaceId);
      const groupId = space ? resolveSpaceGroupId(space, spaceToCollection) ?? "" : "";
      setRenameModal({ spaceId, currentName: name, groupId });
      setRenameInput(name);
    },
    [benchSpaces, spaceToCollection]
  );

  const openViewSpaceById = useCallback(
    (spaceId: string) => {
      if (onViewSpace) {
        onViewSpace(spaceId);
        return;
      }
      navigate(`/properties/${propertyId}/spaces/${spaceId}`);
    },
    [onViewSpace, navigate, propertyId]
  );

  const getSuggestedCopyName = useCallback(
    (baseName: string): string => {
      const base = baseName.trim();
      const baseLower = base.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${baseLower}(?:\\s+(\\d+))?$`, "i");
      let maxNum = 0;
      for (const space of spaces) {
        const name = (space.name ?? "").trim();
        const m = name.match(re);
        if (m) {
          const n = m[1] ? parseInt(m[1], 10) : 1;
          if (n > maxNum) maxNum = n;
        }
      }
      return `${base} ${maxNum + 1}`;
    },
    [spaces]
  );

  const createSpace = async (
    name: string,
    groupId: string,
    parentAreaId: string | null = activeAreaId
  ) => {
    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }
    if (!parentAreaId) {
      toast.error("Add a property area first (Areas view)");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSpacesSet.has(trimmed.toLowerCase())) {
      toast.error("Space already exists");
      return;
    }

    pinSpaceOptimistic(trimmed, groupId);
    setBusy(true);
    try {
      const canonical = resolveToCanonicalSpaceType(trimmed) ?? trimmed;
      let spaceTypeId: string | null = null;
      let iconName = "box";

      const { data: exactType } = await supabase
        .from("space_types")
        .select("id, name, default_icon")
        .ilike("name", canonical)
        .limit(1)
        .maybeSingle();

      if (exactType) {
        spaceTypeId = exactType.id;
        iconName = exactType.default_icon || "box";
      } else {
        // Soft match against catalog so new spaces get a sensible type + icon.
        const { data: catalog } = await supabase
          .from("space_types")
          .select("id, name, default_icon")
          .limit(300);
        const needle = canonical.toLowerCase();
        let best: { id: string; default_icon: string | null; score: number } | null = null;
        for (const row of catalog ?? []) {
          const hay = row.name ?? "";
          if (!hay || !isFuzzyMatchSimilarity(needle, hay, 0.72)) continue;
          const score = needle === hay.toLowerCase() ? 1 : 0.8;
          if (!best || score > best.score) {
            best = { id: row.id, default_icon: row.default_icon, score };
          }
        }
        if (best) {
          spaceTypeId = best.id;
          iconName = best.default_icon || "box";
        }
      }

      const { error } = await supabase.from("spaces").insert({
        org_id: orgId,
        property_id: propertyId,
        name: trimmed,
        icon_name: iconName,
        space_type_id: spaceTypeId,
        thumbnail_url: resolveSpaceMiniCardIllustration(canonical),
        parent_space_id: parentAreaId,
      });
      if (error) throw error;
      // Persist group membership for custom names (and suggestions) so cards
      // survive refresh — resolveSpaceGroupId needs this when there's no space_type.
      assignSpaceToCollection(trimmed, groupId);
      setActiveAreaId(parentAreaId);
      toast.success(`Added ${trimmed}`);
      await invalidateSpaces();
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
      const message = err instanceof Error ? err.message : "Failed to add space";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };
  createSpaceRef.current = createSpace;

  const removeSpaceById = async (spaceId: string, name: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("spaces").delete().eq("id", spaceId);
      if (error) throw error;
      unassignSpace(name);
      clearSuggestionOverridesForName(name);
      toast.success(`Removed ${name}`);
      await invalidateSpaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove space";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCustomCollection = (name: string) => {
    const collection = createPropertyCustomCollection(name);
    setCustomCollections((prev) => [...prev, collection]);
    setSelectedGroupId(collection.id);
  };

  const confirmRename = async () => {
    if (!renameModal) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    const newKey = trimmed.toLowerCase().trim();
    const oldKey = renameModal.currentName.toLowerCase().trim();
    if (newKey !== oldKey && selectedSpacesSet.has(newKey)) {
      toast.error("Space already exists");
      return;
    }

    const space =
      spaces.find((s) => s.id === renameModal.spaceId) ??
      findSpaceByName(renameModal.currentName);
    const groupId =
      renameModal.groupId ||
      (space ? resolveSpaceGroupId(space, spaceToCollection) : undefined) ||
      spaceToCollection[oldKey];

    setBusy(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: trimmed })
        .eq("id", renameModal.spaceId);
      if (error) throw error;

      if (newKey !== oldKey) {
        // Always pin the renamed space to the group it was renamed from.
        if (groupId) {
          setSpaceToCollection((prev) => {
            const next = { ...prev };
            delete next[oldKey];
            next[newKey] = groupId;
            return next;
          });
        }

        setSuggestionLabelOverrides((prev) => {
          const next: SuggestionLabelOverrides = { ...prev };
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

      toast.success("Space renamed");
      setRenameModal(null);
      setRenameInput("");
      await invalidateSpaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to rename space";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = async () => {
    if (!copyModal) return;
    const trimmed = copyInput.trim();
    if (!trimmed) return;
    if (selectedSpacesSet.has(trimmed.toLowerCase())) {
      toast.error("Space already exists");
      return;
    }
    await createSpace(trimmed, copyModal.groupId);
    setCopyModal(null);
    setCopyInput("");
  };

  const handleAddFromInput = () => {
    const trimmed = addSpaceName.trim();
    if (!trimmed) return;
    const groupId =
      selectedGroupId !== "all"
        ? selectedGroupId
        : inferSpaceGroupIdFromName(trimmed) ?? ONBOARDING_SPACE_GROUPS[0].id;
    void createSpace(trimmed, groupId);
    setAddSpaceName("");
  };

  /* ------------------------------- rendering ------------------------------- */

  const isSpaceDragActive =
    activeDrag != null && (activeDrag.kind === "space" || activeDrag.kind === "unassigned");

  const renderSpaceMiniCard = (
    space: SpaceWithType,
    metaMode: "area" | "category"
  ) => {
    const name = (space.name ?? "").trim() || "Space";
    const groupId = groupIdBySpaceId[space.id];
    const group = groupId ? getSpaceGroupById(groupId) : undefined;
    const collection = groupId
      ? customCollections.find((c) => c.id === groupId)
      : undefined;
    const parentAreaId =
      typeof space.parent_space_id === "string" ? space.parent_space_id : null;
    const area = parentAreaId ? areaById.get(parentAreaId) : undefined;
    const openCount = openTasksBySpaceId.get(space.id)?.length ?? 0;
    const dragData: OnboardingDragData =
      parentAreaId && areaIdSet.has(parentAreaId)
        ? { kind: "space", spaceName: name, areaId: parentAreaId, spaceId: space.id }
        : { kind: "unassigned", spaceName: name, spaceId: space.id };
    const subItems = (subSpacesByParentId[space.id] ?? []).map((s) => ({
      id: s.id,
      label: (s.name ?? "").trim() || "Sub space",
    }));
    const actions: MiniCardAction[] = [
      { label: "Open", onClick: () => openViewSpaceById(space.id) },
      { label: "Rename", onClick: () => openRenameModal(space.id, name) },
      {
        label: "Duplicate",
        onClick: () => {
          const gid = groupId ?? ONBOARDING_SPACE_GROUPS[0].id;
          const suggested = getSuggestedCopyName(name);
          setCopyModal({ baseName: name, suggestedName: suggested, groupId: gid });
          setCopyInput(suggested);
        },
      },
      {
        label: "Remove",
        destructive: true,
        onClick: () => void removeSpaceById(space.id, name),
      },
    ];
    return (
      <EntityMiniCard
        key={space.id}
        entityId={space.id}
        title={name}
        meta={
          metaMode === "area"
            ? group?.label ?? collection?.name ?? "Space"
            : area?.name ?? "Unassigned"
        }
        thumbSrc={spaceThumb(space)}
        accentColor={metaMode === "area" ? group?.color : area?.color}
        badge={
          openCount > 0 ? (
            <span className="rounded-md bg-card/90 px-1.5 py-0.5 font-mono text-2xs font-semibold text-foreground shadow-e1">
              {openCount}
            </span>
          ) : null
        }
        dragId={`minicard-space:${space.id}`}
        dragData={dragData}
        onOpen={() => openViewSpaceById(space.id)}
        dropCandidate={isSpaceDragActive && draggedSpaceId !== space.id}
        subZone
        subZoneLabel="Add sub space"
        subItems={subItems}
        onOpenSubItem={openViewSpaceById}
        actions={actions}
      />
    );
  };

  const attentionSections: AttentionSection[] = useMemo(() => {
    const entries = benchSpaces
      .filter((space) => (openTasksBySpaceId.get(space.id)?.length ?? 0) > 0)
      .filter(passesControls);
    const sorted =
      sortBy === "title"
        ? sortSpaces(entries)
        : [...entries].sort(
            (a, b) =>
              (openTasksBySpaceId.get(b.id)?.length ?? 0) -
              (openTasksBySpaceId.get(a.id)?.length ?? 0)
          );
    return sorted.map((space) => {
      const name = (space.name ?? "").trim() || "Space";
      const parentAreaId =
        typeof space.parent_space_id === "string" ? space.parent_space_id : null;
      const area = parentAreaId ? areaById.get(parentAreaId) : undefined;
      const spaceTasks = openTasksBySpaceId.get(space.id) ?? [];
      return {
        id: space.id,
        title: name,
        subtitle: area?.name ?? null,
        iconSrc: spaceThumb(space),
        accentColor: area?.color,
        onOpen: () => openViewSpaceById(space.id),
        content: (
          <>
            {spaceTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/task/${task.id}`)}
                metaDensity="compact"
              />
            ))}
          </>
        ),
      };
    });
  }, [
    benchSpaces,
    openTasksBySpaceId,
    passesControls,
    sortBy,
    sortSpaces,
    areaById,
    openViewSpaceById,
    navigate,
  ]);

  const shelfCards = (
    <CollectionShelf prevLabel="Previous groups" nextLabel="Next groups">
      <CollectionShelfCard
        label="All spaces"
        description="Every room and area on this property."
        imageSrc={ALL_SPACES_ILLUSTRATION}
        color={CUSTOM_COLLECTION_COLOR}
        count={benchSpaces.length}
        countNoun="space"
        selected={selectedGroupId === "all"}
        onSelect={() => setSelectedGroupId("all")}
      />
      {ONBOARDING_SPACE_GROUPS.map((group) => (
        <DroppableZone key={group.id} id={groupDroppableId(group.id)} className="shrink-0">
          <CollectionShelfCard
            label={group.label}
            description={group.description}
            imageSrc={getSpaceGroupCardIllustration(group.id) ?? ALL_SPACES_ILLUSTRATION}
            color={group.color}
            count={groupCounts[group.id] ?? 0}
            countNoun="space"
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
              getSpaceGroupCardIllustration("custom") ??
              ALL_SPACES_ILLUSTRATION
            }
            color={CUSTOM_COLLECTION_COLOR}
            count={groupCounts[collection.id] ?? 0}
            countNoun="space"
            selected={selectedGroupId === collection.id}
            onSelect={() => setSelectedGroupId(collection.id)}
          />
        </DroppableZone>
      ))}
      <NewCollectionShelfCard
        placeholder="e.g. Guest wing"
        onCreate={handleCreateCustomCollection}
      />
    </CollectionShelf>
  );

  const addSpaceInput = (
    <div className="flex items-center gap-1.5">
      <Input
        value={addSpaceName}
        onChange={(e) => setAddSpaceName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAddFromInput();
          }
        }}
        placeholder="Add space"
        className="h-8 w-[150px] border-0 bg-background/80 text-sm shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
        aria-label="Add space"
      />
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1"
        disabled={!addSpaceName.trim() || busy}
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
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px] bg-card/55 p-3 shadow-e1 sm:p-4">
        <header className="mb-3 space-y-2.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">{benchTitle}</h2>
              <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {visibleSpaces.length} space{visibleSpaces.length === 1 ? "" : "s"}
                {activeArea ? ` · adding to ${activeArea.name}` : ""}
              </p>
            </div>
            {addSpaceInput}
          </div>

          {suggestionChips.length > 0 && selectedGroup ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                Suggested:
              </span>
              {suggestionChips.map((s) => (
                <DraggableChipShell
                  key={s.source}
                  id={`space-suggestion:${selectedGroup.id}:${normalizeSpaceMatchKey(s.source)}`}
                  data={{
                    kind: "suggestion",
                    spaceName: s.label,
                    groupId: selectedGroup.id,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void createSpace(s.label, selectedGroup.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-[8px] bg-background px-2 py-1",
                      "font-mono text-2xs uppercase tracking-wide text-foreground/80 shadow-e1",
                      "hover:text-foreground hover:shadow-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    )}
                  >
                    <Plus className="h-3 w-3 opacity-60" />
                    {shortSpaceLabel(s.label)}
                  </button>
                </DraggableChipShell>
              ))}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleSpaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <p className="text-sm text-foreground/90">
                {selectedGroupId === "all" && selectedFilters.size === 0 && !effectiveSearch
                  ? "No spaces yet — add areas in the Areas view, then add spaces."
                  : `No ${selectedGroupId === "all" ? "spaces" : `${benchTitle} spaces`} match the current filters.`}
              </p>
              {selectedGroupId !== "all" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedGroupId("all")}
                >
                  Show all spaces
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 pb-4">
              {visibleSpaces.map((space) => renderSpaceMiniCard(space, "area"))}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const areasView = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-[12px] bg-card/55 p-3 shadow-e1 sm:p-4">
      {areas.map((area) => {
        const areaRooms = sortSpaces(
          (roomsByAreaId[area.id] ?? []).filter(
            (s) => !subSpaceIds.has(s.id) && passesControls(s)
          )
        );
        return (
          <div key={area.id} className="min-w-0">
            <DroppableZone
              id={areaDroppableId(area.id)}
              className="rounded-[10px]"
              activeClassName="ring-2 ring-primary/50 bg-primary/10"
            >
              <div className="group/areahead flex items-center gap-2 rounded-[10px] px-1.5 py-1">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: area.color }}
                  aria-hidden
                />
                <h3 className="text-sm font-semibold text-foreground">{area.name}</h3>
                <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  {(roomsByAreaId[area.id] ?? []).length}
                </span>
                <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/areahead:opacity-100">
                  <button
                    type="button"
                    onClick={() => openRenameArea(area.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label={`Rename ${area.name}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveArea(area.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${area.name}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              </div>
            </DroppableZone>
            {areaRooms.length > 0 ? (
              <div className="flex flex-wrap gap-3 px-1.5 pt-2">
                {areaRooms.map((space) => renderSpaceMiniCard(space, "category"))}
              </div>
            ) : (
              <p className="px-1.5 pt-1 text-2xs text-muted-foreground/70">
                Drop spaces here to move them into {area.name}.
              </p>
            )}
            <div className="mt-3 border-t border-dashed border-border/45" aria-hidden />
          </div>
        );
      })}

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
              {unassigned.filter((s) => !subSpaceIds.has(s.id)).length}
            </span>
          </div>
        </DroppableZone>
        {(() => {
          const rows = sortSpaces(
            unassigned.filter((s) => !subSpaceIds.has(s.id) && passesControls(s))
          );
          return rows.length > 0 ? (
            <div className="flex flex-wrap gap-3 px-1.5 pt-2">
              {rows.map((space) => renderSpaceMiniCard(space, "category"))}
            </div>
          ) : (
            <p className="px-1.5 pt-1 text-2xs text-muted-foreground/70">
              Drop a space here to take it out of its area.
            </p>
          );
        })()}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <Input
          value={addAreaName}
          onChange={(e) => setAddAreaName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAddArea(addAreaName);
              setAddAreaName("");
            }
          }}
          placeholder="Add area (e.g. 1st floor)"
          className="h-8 max-w-[240px] border-0 bg-background/80 text-sm shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-primary/40"
          aria-label="Add area"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!addAreaName.trim() || busy}
          onClick={() => {
            void handleAddArea(addAreaName);
            setAddAreaName("");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {addSpaceInput}
      </div>
    </section>
  );

  const attentionView = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px] bg-card/55 p-3 shadow-e1 sm:p-4">
      <AttentionListView
        sections={attentionSections}
        emptyState={
          <span>
            No spaces with open work
            {selectedFilters.size > 0 || effectiveSearch ? " match the current filters" : ""}.
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
            ariaLabel="Spaces views"
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
            searchPlaceholder="Search spaces"
          />

          {view === "attention" ? attentionView : view === "areas" ? areasView : categoryView}
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
              Rename space
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
              New space name
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

      <Dialog
        open={!!renameAreaModal}
        onOpenChange={(open) => !open && setRenameAreaModal(null)}
      >
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wider">
              Rename area
            </DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={renameAreaInput}
            onChange={(e) => setRenameAreaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmRenameArea();
              }
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <NeomorphicButton variant="ghost" onClick={() => setRenameAreaModal(null)}>
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              variant="primary"
              onClick={() => void confirmRenameArea()}
              disabled={!renameAreaInput.trim() || busy}
            >
              Save
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!areaDeleteModal}
        onOpenChange={(open) => !open && setAreaDeleteModal(null)}
      >
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wider">
              Delete area
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This area has {areaDeleteModal?.spaceCount ?? 0} spaces. You can transfer them
            to another area, or delete the area and its spaces.
          </p>
          {(areaDeleteModal?.spaceCount ?? 0) > 5 ? (
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">Transfer spaces to</label>
              <select
                value={transferTargetAreaId}
                onChange={(e) => setTransferTargetAreaId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {areas
                  .filter((a) => a.id !== areaDeleteModal?.areaId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <NeomorphicButton variant="ghost" onClick={() => setAreaDeleteModal(null)}>
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              variant="ghost"
              onClick={() => void confirmDeleteArea("delete")}
              disabled={busy}
            >
              Delete all
            </NeomorphicButton>
            <NeomorphicButton
              variant="primary"
              onClick={() => void confirmDeleteArea("transfer")}
              disabled={busy || !transferTargetAreaId}
            >
              Transfer & delete area
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
