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
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSpacesWithTypes, type SpaceWithType } from "@/hooks/useSpacesWithTypes";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import { OnboardingCustomCollectionCard } from "@/components/onboarding/OnboardingCustomCollectionCard";
import { OnboardingCustomCollectionDraftCard } from "@/components/onboarding/OnboardingCustomCollectionDraftCard";
import { OnboardingPropertyAreasCard } from "@/components/onboarding/OnboardingPropertyAreasCard";
import {
  ONBOARDING_SPACE_GROUPS,
  getGroupIdFromDefaultUiGroup,
  getSpaceGroupById,
  inferSpaceGroupIdFromName,
  isCustomCollectionGroupId,
  normalizeSpaceMatchKey,
  type GroupExtraSpace,
  type OnboardingCustomCollection,
  type SuggestionLabelOverrides,
} from "@/components/onboarding/onboardingSpaceGroups";
import {
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import {
  type OnboardingDragData,
  parseSpaceIdSortableId,
  onboardingDragLabel,
} from "@/components/onboarding/onboardingAreasDnd";
import {
  createPropertyCustomCollection,
  loadPropertyCustomSpaceGroups,
  savePropertyCustomSpaceGroups,
} from "@/lib/propertyCustomSpaceGroupsStorage";
import {
  partitionPropertySpaces,
  selectedSpaceColorsFromPartition,
  spaceAreaByNameKeyFromPartition,
  toOnboardingAreas,
} from "@/lib/spaces/partitionPropertySpaces";
import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import { PropertySpaceAreasStrip } from "@/components/spaces/PropertySpaceAreasStrip";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { isFuzzyMatchSimilarity } from "@/services/ai/fuzzyMatch";
import { resolveSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";
import { cn } from "@/lib/utils";

type PropertySpaceGroupCarouselProps = {
  propertyId: string;
  className?: string;
  /** Filters space chips across group cards (case-insensitive). */
  spaceFilter?: string;
  /** Open space/area detail in the parent surface (panel / modal). */
  onViewSpace?: (spaceId: string) => void;
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

export function PropertySpaceGroupCarousel({
  propertyId,
  className,
  spaceFilter = "",
  onViewSpace,
}: PropertySpaceGroupCarouselProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { spaces, refresh } = useSpacesWithTypes(propertyId);

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
  /** Optimistic newest-first pins so chips appear at the top before refetch settles. */
  const [pendingPinsByGroup, setPendingPinsByGroup] = useState<Record<string, string[]>>({});
  const skipPersistCustomGroupsRef = useRef(true);

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [viewingAreaId, setViewingAreaId] = useState<string | null>(null);
  const [areaOrderIds, setAreaOrderIds] = useState<string[]>([]);
  const [activeDrag, setActiveDrag] = useState<OnboardingDragData | null>(null);
  const [showAddSpacesInstruction, setShowAddSpacesInstruction] = useState(false);
  const [instructionOpacity, setInstructionOpacity] = useState(1);
  const instructionFadeRef = useRef<number | null>(null);
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

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const {
    areas: partitionedAreas,
    rooms,
    roomsByAreaId,
    unassigned,
  } = useMemo(() => partitionPropertySpaces(spaces), [spaces]);

  const areas: OnboardingArea[] = useMemo(() => {
    const mapped = toOnboardingAreas(partitionedAreas);
    if (areaOrderIds.length === 0) return mapped;
    const byId = new Map(mapped.map((a) => [a.id, a]));
    const ordered: OnboardingArea[] = [];
    for (const id of areaOrderIds) {
      const area = byId.get(id);
      if (area) {
        ordered.push(area);
        byId.delete(id);
      }
    }
    for (const area of byId.values()) ordered.push(area);
    return ordered;
  }, [partitionedAreas, areaOrderIds]);

  const spaceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const area of areas) {
      counts[area.id] = (roomsByAreaId[area.id] ?? []).length;
    }
    return counts;
  }, [areas, roomsByAreaId]);

  const spaceAreaByNameKey = useMemo(
    () => spaceAreaByNameKeyFromPartition(roomsByAreaId, areas),
    [roomsByAreaId, areas]
  );

  const selectedSpaceColors = useMemo(
    () => selectedSpaceColorsFromPartition(spaceAreaByNameKey, areas),
    [spaceAreaByNameKey, areas]
  );

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null;

  useEffect(() => {
    setAreaOrderIds((prev) => {
      const ids = partitionedAreas.map((a) => a.id);
      if (prev.length === 0) return ids;
      const known = new Set(ids);
      const kept = prev.filter((id) => known.has(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [partitionedAreas]);

  useEffect(() => {
    if (areas.length === 0) {
      setActiveAreaId(null);
      setViewingAreaId(null);
      return;
    }
    if (activeAreaId && areas.some((a) => a.id === activeAreaId)) return;
    setActiveAreaId(areas[0].id);
    setViewingAreaId(areas[0].id);
  }, [areas, activeAreaId]);

  const triggerAreaInstruction = useCallback(() => {
    setShowAddSpacesInstruction(true);
    setInstructionOpacity(1);
    if (instructionFadeRef.current) window.clearTimeout(instructionFadeRef.current);
    instructionFadeRef.current = window.setTimeout(() => {
      setInstructionOpacity(0);
      window.setTimeout(() => setShowAddSpacesInstruction(false), 400);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (instructionFadeRef.current) window.clearTimeout(instructionFadeRef.current);
    };
  }, []);

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
      rooms.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
    );
    for (const pins of Object.values(pendingPinsByGroup)) {
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (key) set.add(key);
      }
    }
    return set;
  }, [rooms, pendingPinsByGroup]);

  useEffect(() => {
    const existing = new Set(
      rooms.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
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
  }, [rooms]);

  const pinSpaceOptimistic = useCallback((name: string, groupId: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    setPendingPinsByGroup((prev) => {
      const existing = (prev[groupId] ?? []).filter((n) => n.toLowerCase().trim() !== key);
      return { ...prev, [groupId]: [trimmed, ...existing] };
    });
  }, []);

  const selectedSpacesNewestFirstByGroup = useMemo(() => {
    const result: Record<string, string[]> = {};
    const sorted = [...rooms].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const space of sorted) {
      const name = space.name?.trim();
      if (!name) continue;
      const groupId = resolveSpaceGroupId(space, spaceToCollection);
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
  }, [rooms, spaceToCollection, pendingPinsByGroup]);

  const extraSpacesByGroup = useMemo(() => {
    const result: Record<string, GroupExtraSpace[]> = {};
    const sorted = [...rooms].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const space of sorted) {
      const name = space.name?.trim();
      if (!name) continue;
      const groupId = resolveSpaceGroupId(space, spaceToCollection);
      if (!groupId) continue;
      if (isCustomCollectionGroupId(groupId)) {
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
      const pendingExtras: GroupExtraSpace[] = [];
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (existingKeys.has(key)) continue;
        if (!isCustomCollectionGroupId(groupId) && isSuggestionForGroup(name, groupId)) {
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
  }, [rooms, spaceToCollection, pendingPinsByGroup]);

  const filterKey = spaceFilter.trim().toLowerCase();

  /** While searching, only keep groups that already contain a matching space (not bare suggestions). */
  const groupMatchesFilter = useCallback(
    (groupId: string) => {
      if (!filterKey) return true;
      const selected = selectedSpacesNewestFirstByGroup[groupId] ?? [];
      return selected.some((n) => n.toLowerCase().includes(filterKey));
    },
    [filterKey, selectedSpacesNewestFirstByGroup]
  );

  const visibleGroups = useMemo(
    () => ONBOARDING_SPACE_GROUPS.filter((group) => groupMatchesFilter(group.id)),
    [groupMatchesFilter]
  );

  const visibleCustomCollections = useMemo(
    () => customCollections.filter((collection) => groupMatchesFilter(collection.id)),
    [customCollections, groupMatchesFilter]
  );

  const hasVisibleGroups = visibleGroups.length > 0 || visibleCustomCollections.length > 0;

  const invalidateSpaces = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["spaces"] });
    await refresh();
  }, [queryClient, refresh]);

  const findSpaceByName = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      return rooms.find((s) => (s.name ?? "").toLowerCase().trim() === key);
    },
    [rooms]
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

  const handleSelectArea = useCallback(
    async (name: string, _color: string) => {
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
        setViewingAreaId(existingArea.id);
        triggerAreaInstruction();
        return;
      }
      // Same name already on the property (e.g. flat room) — promote / activate.
      const existingSpace = spaces.find(
        (s) => (s.name ?? "").toLowerCase().trim() === key
      );
      if (existingSpace) {
        if (existingSpace.parent_space_id) {
          toast.error("A space with that name already exists in an area");
          return;
        }
        setAreaOrderIds((prev) =>
          prev.includes(existingSpace.id) ? prev : [...prev, existingSpace.id]
        );
        setActiveAreaId(existingSpace.id);
        setViewingAreaId(existingSpace.id);
        triggerAreaInstruction();
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
        const id = data.id as string;
        setAreaOrderIds((prev) => [...prev, id]);
        setActiveAreaId(id);
        setViewingAreaId(id);
        triggerAreaInstruction();
        toast.success(`Added area ${trimmed}`);
        await invalidateSpaces();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to add area";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [areas, spaces, orgId, propertyId, invalidateSpaces, triggerAreaInstruction]
  );

  const handleActivateArea = useCallback(
    (areaId: string) => {
      setActiveAreaId(areaId);
      setViewingAreaId((prev) => (prev === areaId ? null : areaId));
      triggerAreaInstruction();
      onViewSpace?.(areaId);
    },
    [triggerAreaInstruction, onViewSpace]
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
        setAreaOrderIds((prev) => prev.filter((id) => id !== areaId));
        setActiveAreaId((prev) => {
          if (prev !== areaId) return prev;
          return areas.find((a) => a.id !== areaId)?.id ?? null;
        });
        setViewingAreaId((prev) => (prev === areaId ? null : prev));
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
          setAreaOrderIds((prev) => prev.filter((id) => id !== areaId));
          setActiveAreaId(transferTargetAreaId);
          setViewingAreaId(transferTargetAreaId);
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
    async (spaceId: string, targetAreaId: string) => {
      setBusy(true);
      try {
        await setSpaceParent(spaceId, targetAreaId);
        setActiveAreaId(targetAreaId);
        setViewingAreaId(targetAreaId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to move space";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [setSpaceParent]
  );

  const createSpaceRef = useRef<
    (name: string, groupId: string, parentAreaId?: string | null) => Promise<void>
  >(async () => undefined);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as OnboardingDragData | undefined;
    setActiveDrag(data ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;
      const drag = active.data.current as OnboardingDragData | undefined;
      const overId = String(over.id);

      if (drag?.kind === "area" && overId.startsWith("area:")) {
        const activeId = drag.areaId;
        const overAreaId = overId.slice("area:".length);
        if (activeId === overAreaId) return;
        setAreaOrderIds((prev) => {
          const oldIndex = prev.indexOf(activeId);
          const newIndex = prev.indexOf(overAreaId);
          if (oldIndex < 0 || newIndex < 0) return prev;
          return arrayMove(prev, oldIndex, newIndex);
        });
        return;
      }

      const resolveSpaceId = (): string | null => {
        if (drag?.kind === "space" && drag.spaceId) return drag.spaceId;
        if (drag?.kind === "unassigned") return drag.spaceId;
        if (drag?.kind === "space") {
          return findSpaceByName(drag.spaceName)?.id ?? null;
        }
        return null;
      };

      if (
        (drag?.kind === "space" || drag?.kind === "unassigned") &&
        overId.startsWith("area-drop:")
      ) {
        const spaceId = resolveSpaceId();
        const targetAreaId = overId.slice("area-drop:".length);
        if (spaceId) void moveSpaceToArea(spaceId, targetAreaId);
        return;
      }

      if (drag?.kind === "space" && overId.startsWith("space-id:")) {
        const overParsed = parseSpaceIdSortableId(overId);
        if (!overParsed) return;
        const spaceId = resolveSpaceId();
        if (!spaceId) return;
        if (drag.areaId !== overParsed.areaId) {
          void moveSpaceToArea(spaceId, overParsed.areaId);
        }
        return;
      }

      if (drag?.kind === "unassigned" && overId === "spaces-list" && activeAreaId) {
        void moveSpaceToArea(drag.spaceId, activeAreaId);
        return;
      }

      if (drag?.kind === "suggestion") {
        if (overId.startsWith("area-drop:")) {
          const targetAreaId = overId.slice("area-drop:".length);
          setActiveAreaId(targetAreaId);
          setViewingAreaId(targetAreaId);
          void createSpaceRef.current(drag.spaceName, drag.groupId, targetAreaId);
          return;
        }
        if (overId === "spaces-list" || overId.startsWith("space-id:")) {
          if (!activeAreaId) {
            toast.error("Select a property area first");
            return;
          }
          void createSpaceRef.current(drag.spaceName, drag.groupId, activeAreaId);
        }
      }
    },
    [findSpaceByName, moveSpaceToArea, activeAreaId]
  );

  const openRenameModal = useCallback(
    (name: string, groupId: string) => {
      const space = findSpaceByName(name);
      if (!space) return;
      setRenameModal({ spaceId: space.id, currentName: name, groupId });
      setRenameInput(name);
    },
    [findSpaceByName]
  );

  /** Stable name-key → open space detail. Enables View whenever the space exists in DB. */
  const viewSpaceByNameKey = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    for (const space of rooms) {
      const key = (space.name ?? "").toLowerCase().trim();
      if (!key || handlers[key]) continue;
      const spaceId = space.id;
      handlers[key] = () => {
        if (onViewSpace) {
          onViewSpace(spaceId);
          return;
        }
        navigate(`/properties/${propertyId}/spaces/${spaceId}`);
      };
    }
    return handlers;
  }, [rooms, navigate, propertyId, onViewSpace]);

  const openViewSpace = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      const direct = viewSpaceByNameKey[key];
      if (direct) {
        direct();
        return;
      }
      const space = findSpaceByName(name);
      if (!space) {
        toast.error("Space not found");
        return;
      }
      if (onViewSpace) {
        onViewSpace(space.id);
        return;
      }
      navigate(`/properties/${propertyId}/spaces/${space.id}`);
    },
    [viewSpaceByNameKey, findSpaceByName, navigate, propertyId, onViewSpace]
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
      toast.error("Select a property area first");
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
      // Persist group membership for custom names (and suggestions) so chips
      // survive refresh — resolveSpaceGroupId needs this when there's no space_type.
      assignSpaceToCollection(trimmed, groupId);
      setActiveAreaId(parentAreaId);
      setViewingAreaId(parentAreaId);
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

  const removeSpace = async (name: string) => {
    const space = findSpaceByName(name);
    if (!space) return;
    await removeSpaceById(space.id, name);
  };

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
        // Without this, suggestion/type-inferred membership is lost and the
        // space falls out of the card into the property "recent" list.
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

          // Renaming a catalog suggestion: keep the chip in-place with the new label.
          if (groupId && isSuggestionForGroup(renameModal.currentName, groupId)) {
            next[oldKey] = trimmed;
            changed = true;
          }

          // Renaming an already-overridden label: update the override value.
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

  if (filterKey && !hasVisibleGroups && areas.length === 0) {
    return null;
  }

  return (
    <>
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={cn("space-y-4", className)}>
          {!filterKey ? (
            <p className="text-sm text-muted-foreground">
              {areas.length === 0
                ? "Start with Property Areas (floors and zones), then add spaces into the active area."
                : activeArea
                  ? `Active area: ${activeArea.name}. Add spaces from the groups, or drag chips onto area chips.`
                  : "Select an area, then add spaces from the groups below."}
            </p>
          ) : null}
          <SpaceGroupCarousel
            onScroll={(e) => {
              if (e.currentTarget.scrollLeft > 12) {
                setInstructionOpacity(0);
                if (instructionFadeRef.current) clearTimeout(instructionFadeRef.current);
                window.setTimeout(() => setShowAddSpacesInstruction(false), 400);
              }
            }}
          >
            {!filterKey ? (
              <OnboardingPropertyAreasCard
                areas={areas}
                activeAreaId={activeAreaId}
                spaceCounts={spaceCounts}
                onSelectArea={(name, color) => void handleSelectArea(name, color)}
                onActivateArea={handleActivateArea}
                onRemoveArea={handleRemoveArea}
                onRenameArea={openRenameArea}
              />
            ) : null}
            {visibleGroups.map((group, index) => (
              <OnboardingSpaceGroupCard
                key={group.id}
                group={group}
                selectedSpacesSet={selectedSpacesSet}
                selectedSpaceColors={selectedSpaceColors}
                spaceAreaByNameKey={spaceAreaByNameKey}
                activeAreaId={activeAreaId}
                extraSpaces={extraSpacesByGroup[group.id] ?? []}
                selectedSpacesNewestFirst={selectedSpacesNewestFirstByGroup[group.id] ?? []}
                spaceFilter={spaceFilter}
                suggestionLabelOverrides={suggestionLabelOverrides}
                disabled={areas.length === 0}
                instructionOverlay={
                  index === 0 &&
                  showAddSpacesInstruction &&
                  activeArea &&
                  areas.length > 0
                    ? {
                        label: `Add spaces to ${activeArea.name}`,
                        color: activeArea.color,
                      }
                    : null
                }
                instructionOpacity={instructionOpacity}
                onAddSpace={(name) => void createSpace(name, group.id)}
                onRemoveSpace={removeSpace}
                onRenameSpace={openRenameModal}
                onViewSpace={(name) => openViewSpace(name)}
                viewSpaceByNameKey={viewSpaceByNameKey}
                onCopySpace={(name, groupId) => {
                  const suggested = getSuggestedCopyName(name);
                  setCopyModal({ baseName: name, suggestedName: suggested, groupId });
                  setCopyInput(suggested);
                }}
              />
            ))}
            {visibleCustomCollections.map((collection) => (
              <OnboardingCustomCollectionCard
                key={collection.id}
                collection={collection}
                selectedSpacesSet={selectedSpacesSet}
                extraSpaces={extraSpacesByGroup[collection.id] ?? []}
                spaceFilter={spaceFilter}
                onAddSpace={(name) => void createSpace(name, collection.id)}
                onRemoveSpace={removeSpace}
                onRenameSpace={openRenameModal}
                onViewSpace={(name) => openViewSpace(name)}
                viewSpaceByNameKey={viewSpaceByNameKey}
                onCopySpace={(name, groupId) => {
                  const suggested = getSuggestedCopyName(name);
                  setCopyModal({ baseName: name, suggestedName: suggested, groupId });
                  setCopyInput(suggested);
                }}
                onUpdateCollection={handleUpdateCustomCollection}
              />
            ))}
            {!filterKey ? (
              <OnboardingCustomCollectionDraftCard
                onCreateCollection={handleCreateCustomCollection}
              />
            ) : null}
          </SpaceGroupCarousel>

          {!filterKey ? (
            <PropertySpaceAreasStrip
              areas={areas}
              activeAreaId={activeAreaId}
              viewingAreaId={viewingAreaId}
              roomsByAreaId={roomsByAreaId}
              unassigned={unassigned}
              onActivateArea={handleActivateArea}
              onRemoveArea={handleRemoveArea}
              onRenameArea={openRenameArea}
              onRemoveSpace={(spaceId, name) => void removeSpaceById(spaceId, name)}
              onRenameSpace={(spaceId, name) => {
                const groupId =
                  resolveSpaceGroupId(
                    rooms.find((r) => r.id === spaceId) ?? ({} as SpaceWithType),
                    spaceToCollection
                  ) ?? "";
                setRenameModal({ spaceId, currentName: name, groupId });
                setRenameInput(name);
              }}
              onViewSpace={openViewSpaceById}
            />
          ) : null}
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="rounded-[8px] bg-card px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wide shadow-e2">
              {onboardingDragLabel(
                activeDrag,
                activeDrag.kind === "area"
                  ? areas.find((a) => a.id === activeDrag.areaId)?.name
                  : undefined
              )}
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
