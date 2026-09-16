import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import {
  DroppableZone,
  SortableItem,
  areaSortableId,
  parseSpaceSortableId,
  spaceSortableId,
  spacesListDroppableId,
  type OnboardingDragData,
} from "@/components/onboarding/onboardingAreasDnd";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { OnboardingBreadcrumbs } from "@/components/onboarding/OnboardingBreadcrumbs";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import { OnboardingPropertyAreasCard } from "@/components/onboarding/OnboardingPropertyAreasCard";
import { OnboardingCustomCollectionCard } from "@/components/onboarding/OnboardingCustomCollectionCard";
import { OnboardingCustomCollectionDraftCard } from "@/components/onboarding/OnboardingCustomCollectionDraftCard";
import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import {
  ONBOARDING_SPACE_GROUPS,
  createCustomCollectionId,
  shortSpaceLabel,
  type GroupExtraSpace,
  type OnboardingCustomCollection,
  type SuggestionLabelOverrides,
} from "@/components/onboarding/onboardingSpaceGroups";
import {
  AREA_CHIP_BASE_CLASS,
  AREA_CHIP_NEUMO_RAISED,
  areaSpacesRowLabel,
  createAreaId,
  getSuggestedAreaColor,
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganization } from "@/hooks/use-organization";
import { useBuildingPlans } from "@/hooks/property/useBuildingPlans";
import { getPostAddSpacesRoute } from "@/lib/propertyProfiles";
import { finishOwnerOnboarding } from "@/utils/completeOnboarding";
import { useOnboardingPropertyProfile } from "@/hooks/useOnboardingPropertyProfile";
import { toast } from "sonner";
import { Plus, FileUp, Loader2 } from "lucide-react";
import addAreasSpacesIcon from "@/assets/onboarding/add-areas-spaces.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Hidden until plan upload/extraction has been tested more.
const SHOW_PROPERTY_PLANS_PANEL = false;

export default function AddSpaceScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  /** Spaces keyed by area id (progressive Areas → Spaces). */
  const [spacesByAreaId, setSpacesByAreaId] = useState<Record<string, string[]>>({});
  const [areas, setAreas] = useState<OnboardingArea[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  /** Which area’s spaces row is expanded under YOUR AREAS (one at a time). */
  const [viewingAreaId, setViewingAreaId] = useState<string | null>(null);
  const [showAddSpacesInstruction, setShowAddSpacesInstruction] = useState(false);
  const [instructionOpacity, setInstructionOpacity] = useState(0);
  const [areaDeleteModal, setAreaDeleteModal] = useState<{
    areaId: string;
    spaceCount: number;
  } | null>(null);
  const [transferTargetAreaId, setTransferTargetAreaId] = useState<string>("");
  const [renameAreaModal, setRenameAreaModal] = useState<{ areaId: string; name: string } | null>(
    null
  );
  const [renameAreaInput, setRenameAreaInput] = useState("");
  const [activeDrag, setActiveDrag] = useState<OnboardingDragData | null>(null);
  const instructionFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subSpacesByParent, setSubSpacesByParent] = useState<Record<string, string[]>>({});
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [hasExistingSpaces, setHasExistingSpaces] = useState(false);
  const [hasProperties, setHasProperties] = useState(false);
  const [copyModal, setCopyModal] = useState<{
    baseName: string;
    suggestedName: string;
    groupId?: string;
  } | null>(null);
  const [copyModalInput, setCopyModalInput] = useState("");
  const [renameModal, setRenameModal] = useState<{ currentName: string } | null>(null);
  const [renameModalInput, setRenameModalInput] = useState("");
  /** Lowercase space name → onboarding group id (for card chip display). */
  const [spaceGroupByName, setSpaceGroupByName] = useState<Record<string, string>>({});
  /** Extra space names per group card (custom adds + duplicates not in suggestions). */
  const [groupExtraSpaces, setGroupExtraSpaces] = useState<Record<string, GroupExtraSpace[]>>({});
  /** Renamed labels for static suggestion chips on group cards (key = original suggestion). */
  const [suggestionLabelOverrides, setSuggestionLabelOverrides] =
    useState<SuggestionLabelOverrides>({});
  /** User-created custom collection cards (each gets a unique group id). */
  const [customCollections, setCustomCollections] = useState<OnboardingCustomCollection[]>([]);
  const [planFiles, setPlanFiles] = useState<FileList | null>(null);
  const spaceInputRef = useRef<HTMLInputElement>(null);
  const propertyProfile = useOnboardingPropertyProfile();
  // Pass undefined while the panel is hidden so the hook's queries stay disabled
  // (the plan tables don't exist in the remote DB yet).
  const plans = useBuildingPlans(SHOW_PROPERTY_PLANS_PANEL ? propertyId || undefined : undefined);

  const spaces = useMemo(
    () => areas.flatMap((a) => spacesByAreaId[a.id] ?? []),
    [areas, spacesByAreaId]
  );

  const spaceAreaByNameKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of areas) {
      for (const s of spacesByAreaId[a.id] ?? []) {
        map[s.toLowerCase().trim()] = a.id;
      }
    }
    return map;
  }, [areas, spacesByAreaId]);

  const selectedSpaceColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of areas) {
      for (const s of spacesByAreaId[a.id] ?? []) {
        map[s.toLowerCase().trim()] = a.color;
      }
    }
    return map;
  }, [areas, spacesByAreaId]);

  const activeArea = useMemo(
    () => areas.find((a) => a.id === activeAreaId) ?? null,
    [areas, activeAreaId]
  );

  const viewingArea = useMemo(
    () => areas.find((a) => a.id === viewingAreaId) ?? null,
    [areas, viewingAreaId]
  );

  const spaceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of areas) counts[a.id] = (spacesByAreaId[a.id] ?? []).length;
    return counts;
  }, [areas, spacesByAreaId]);

  const triggerAreaInstruction = useCallback(() => {
    setShowAddSpacesInstruction(true);
    setInstructionOpacity(1);
    if (instructionFadeRef.current) clearTimeout(instructionFadeRef.current);
    instructionFadeRef.current = setTimeout(() => {
      setInstructionOpacity(0);
      window.setTimeout(() => setShowAddSpacesInstruction(false), 500);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (instructionFadeRef.current) clearTimeout(instructionFadeRef.current);
    };
  }, []);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (!orgLoading && orgId) {
      // Add a small delay to ensure property is committed after creation
      const timer = setTimeout(() => {
        fetchLatestProperty();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!orgLoading && !orgId) {
      toast.error("Organisation not found");
      navigate("/onboarding/create-organisation");
    }
  }, [orgId, orgLoading]);

  // Scoped to the current property: spaces on other properties in the org
  // shouldn't trigger the "you already have spaces" messaging during onboarding.
  const checkExistingSpaces = async (currentPropertyId: string) => {
    try {
      const { data: existingSpaces } = await supabase
        .from('spaces')
        .select('id')
        .eq('property_id', currentPropertyId)
        .limit(1);
      
      setHasExistingSpaces(existingSpaces && existingSpaces.length > 0);
    } catch (error) {
      console.error("Error checking existing spaces:", error);
    }
  };

  const fetchLatestProperty = async () => {
    if (!orgId) return;
    
    try {
      // Refresh session to ensure JWT is up to date
      await supabase.auth.refreshSession();
      
      // Get the latest property for this org
      // Retry a few times in case of timing issues
      let retries = 3;
      let properties = null;
      let propertiesError = null;
      
      while (retries > 0) {
        const result = await supabase
          .from('properties')
          .select('id')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        properties = result.data;
        propertiesError = result.error;
        
        if (properties && properties.length > 0) {
          break; // Found property, exit retry loop
        }
        
        if (propertiesError) {
          console.error("Error fetching properties:", propertiesError);
          break; // Error occurred, exit retry loop
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 300));
        retries--;
      }

      if (propertiesError) {
        console.error("Error fetching properties after retries:", propertiesError);
        setHasProperties(false);
        return;
      }

      if (properties && properties.length > 0) {
        const property = properties[0];
        setPropertyId(property.id);
        setHasProperties(true);
        checkExistingSpaces(property.id);
        
        // Fetch property name/address for breadcrumb
        const { data: propertyData } = await supabase
          .from('properties')
          .select('address')
          .eq('id', property.id)
          .single();
        
        if (propertyData) {
          setPropertyName(propertyData.address || "Property");
        }
      } else {
        setHasProperties(false);
      }
    } catch (error) {
      console.error("Error fetching property:", error);
      setHasProperties(false);
    }
  };

  const addSpaceToActiveArea = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (!activeAreaId) {
      toast.error("Select a property area first");
      return false;
    }
    const key = trimmed.toLowerCase();
    if (spaces.some((s) => s.toLowerCase() === key)) {
      return false;
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return false;
    }
    setSpacesByAreaId((prev) => ({
      ...prev,
      [activeAreaId]: [trimmed, ...(prev[activeAreaId] ?? [])],
    }));
    setViewingAreaId(activeAreaId);
    return true;
  };

  const handleSelectArea = (name: string, color: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const existing = areas.find((a) => a.name.toLowerCase() === key);
    if (existing) {
      setActiveAreaId(existing.id);
      setViewingAreaId(existing.id);
      triggerAreaInstruction();
      return;
    }
    const id = createAreaId();
    const area: OnboardingArea = {
      id,
      name: trimmed,
      color: color || getSuggestedAreaColor(trimmed),
    };
    // Keep selection order stable — do not jump the new area to the front of the card.
    setAreas((prev) => [...prev, area]);
    setSpacesByAreaId((prev) => ({ ...prev, [id]: [] }));
    setActiveAreaId(id);
    setViewingAreaId(id);
    triggerAreaInstruction();
  };

  const handleActivateArea = (areaId: string) => {
    setActiveAreaId(areaId);
    setViewingAreaId((prev) => (prev === areaId ? null : areaId));
    triggerAreaInstruction();
  };

  const purgeAreaSpaces = (areaId: string, spaceNames: string[]) => {
    for (const s of spaceNames) {
      unlinkSpaceFromGroup(s);
      clearSuggestionLabelOverride(s.toLowerCase().trim());
    }
    setAreas((prev) => prev.filter((a) => a.id !== areaId));
    setSpacesByAreaId((prev) => {
      const next = { ...prev };
      delete next[areaId];
      return next;
    });
    setActiveAreaId((prev) => {
      if (prev !== areaId) return prev;
      const remaining = areas.filter((a) => a.id !== areaId);
      return remaining[0]?.id ?? null;
    });
    setViewingAreaId((prev) => (prev === areaId ? null : prev));
  };

  const handleRemoveArea = (areaId: string) => {
    const removedSpaces = spacesByAreaId[areaId] ?? [];
    if (removedSpaces.length > 5) {
      setAreaDeleteModal({ areaId, spaceCount: removedSpaces.length });
      setTransferTargetAreaId(
        areas.find((a) => a.id !== areaId)?.id ?? ""
      );
      return;
    }
    purgeAreaSpaces(areaId, removedSpaces);
  };

  const confirmDeleteArea = (mode: "delete" | "transfer") => {
    if (!areaDeleteModal) return;
    const { areaId } = areaDeleteModal;
    const removedSpaces = spacesByAreaId[areaId] ?? [];
    if (mode === "transfer" && transferTargetAreaId && transferTargetAreaId !== areaId) {
      setSpacesByAreaId((prev) => {
        const moving = prev[areaId] ?? [];
        const target = prev[transferTargetAreaId] ?? [];
        const next = { ...prev };
        next[transferTargetAreaId] = [...moving, ...target];
        delete next[areaId];
        return next;
      });
      setAreas((prev) => prev.filter((a) => a.id !== areaId));
      setActiveAreaId((prev) => (prev === areaId ? transferTargetAreaId : prev));
      setViewingAreaId((prev) => (prev === areaId ? transferTargetAreaId : prev));
    } else {
      purgeAreaSpaces(areaId, removedSpaces);
    }
    setAreaDeleteModal(null);
    setTransferTargetAreaId("");
  };

  const openRenameArea = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return;
    setRenameAreaModal({ areaId, name: area.name });
    setRenameAreaInput(area.name);
  };

  const confirmRenameArea = () => {
    if (!renameAreaModal) return;
    const trimmed = renameAreaInput.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (
      areas.some(
        (a) => a.id !== renameAreaModal.areaId && a.name.toLowerCase() === key
      )
    ) {
      toast.error("Area already exists");
      return;
    }
    setAreas((prev) =>
      prev.map((a) => (a.id === renameAreaModal.areaId ? { ...a, name: trimmed } : a))
    );
    setRenameAreaModal(null);
    setRenameAreaInput("");
  };

  const moveSpaceToArea = (spaceName: string, targetAreaId: string) => {
    const key = spaceName.toLowerCase().trim();
    const fromAreaId = spaceAreaByNameKey[key];
    if (!fromAreaId || fromAreaId === targetAreaId) {
      if (!fromAreaId && activeAreaId === targetAreaId) {
        addSpaceToActiveArea(spaceName);
      }
      return;
    }
    setSpacesByAreaId((prev) => {
      const fromList = (prev[fromAreaId] ?? []).filter((s) => s.toLowerCase().trim() !== key);
      const moving = (prev[fromAreaId] ?? []).find((s) => s.toLowerCase().trim() === key);
      if (!moving) return prev;
      return {
        ...prev,
        [fromAreaId]: fromList,
        [targetAreaId]: [moving, ...(prev[targetAreaId] ?? [])],
      };
    });
    setActiveAreaId(targetAreaId);
    setViewingAreaId(targetAreaId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as OnboardingDragData | undefined;
    setActiveDrag(data ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const drag = active.data.current as OnboardingDragData | undefined;
    const overId = String(over.id);

    if (drag?.kind === "area" && overId.startsWith("area:")) {
      const activeId = drag.areaId;
      const overAreaId = overId.slice("area:".length);
      if (activeId === overAreaId) return;
      setAreas((prev) => {
        const oldIndex = prev.findIndex((a) => a.id === activeId);
        const newIndex = prev.findIndex((a) => a.id === overAreaId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      return;
    }

    if (drag?.kind === "space" && overId.startsWith("space:")) {
      const overParsed = parseSpaceSortableId(overId);
      if (!overParsed) return;
      if (drag.areaId !== overParsed.areaId) {
        moveSpaceToArea(drag.spaceName, overParsed.areaId);
        return;
      }
      setSpacesByAreaId((prev) => {
        const list = prev[overParsed.areaId] ?? [];
        const oldIndex = list.findIndex(
          (s) => s.toLowerCase().trim() === drag.spaceName.toLowerCase().trim()
        );
        const newIndex = list.findIndex(
          (s) => s.toLowerCase().trim() === overParsed.spaceKey
        );
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, [overParsed.areaId]: arrayMove(list, oldIndex, newIndex) };
      });
      return;
    }

    if (drag?.kind === "space" && overId.startsWith("area-drop:")) {
      moveSpaceToArea(drag.spaceName, overId.slice("area-drop:".length));
      return;
    }

    if (drag?.kind === "suggestion") {
      if (overId.startsWith("area-drop:")) {
        const targetAreaId = overId.slice("area-drop:".length);
        setActiveAreaId(targetAreaId);
        setViewingAreaId(targetAreaId);
        // add after active set — use direct write
        const key = drag.spaceName.toLowerCase().trim();
        if (spaces.some((s) => s.toLowerCase() === key)) {
          const owner = spaceAreaByNameKey[key];
          if (owner && owner !== targetAreaId) openCopyModal(drag.spaceName, drag.groupId);
          return;
        }
        setSpacesByAreaId((prev) => ({
          ...prev,
          [targetAreaId]: [drag.spaceName, ...(prev[targetAreaId] ?? [])],
        }));
        addSpaceToGroupCard(drag.spaceName, drag.groupId);
        return;
      }
      if (overId === spacesListDroppableId() || overId.startsWith("space:")) {
        handleAddSuggestionFromGroup(drag.spaceName, drag.groupId);
        return;
      }
      if (overId.startsWith("group:")) {
        const targetGroupId = overId.slice("group:".length);
        handleAddSuggestionFromGroup(drag.spaceName, targetGroupId);
        return;
      }
    }

    if (drag?.kind === "space" && overId.startsWith("group:")) {
      const targetGroupId = overId.slice("group:".length);
      addSpaceToGroupCard(drag.spaceName, targetGroupId, true);
      return;
    }

    if (drag?.kind === "space" && overId === spacesListDroppableId() && activeAreaId) {
      // already in an area — ensure viewing active list
      setViewingAreaId(activeAreaId);
    }
  };

  const handleAddSpace = () => {
    const trimmed = spaceName.trim();
    if (!trimmed) return;

    if (!activeAreaId) {
      toast.error("Select a property area first");
      return;
    }

    if (spaces.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      const ownerAreaId = spaceAreaByNameKey[trimmed.toLowerCase()];
      if (ownerAreaId && ownerAreaId !== activeAreaId) {
        openCopyModal(trimmed);
        setSpaceName("");
        return;
      }
      toast.error("Space already added");
      return;
    }

    if (!addSpaceToActiveArea(trimmed)) return;
    const key = trimmed.toLowerCase().trim();
    const matchingGroups = ONBOARDING_SPACE_GROUPS.filter((g) =>
      g.suggestedSpaces.some((s) => s.toLowerCase().trim() === key)
    );
    if (matchingGroups.length === 1) {
      addSpaceToGroupCard(trimmed, matchingGroups[0].id);
    }
    setSpaceName("");
  };

  const addToGroupExtraSpaces = (
    groupId: string,
    name: string,
    options?: { insertAfter?: string }
  ) => {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    setGroupExtraSpaces((prev) => {
      const list = prev[groupId] ?? [];
      if (list.some((s) => s.name.toLowerCase().trim() === key)) return prev;
      // Newest extras first so chips pin to the top of the group card.
      return {
        ...prev,
        [groupId]: [{ name: trimmed, insertAfter: options?.insertAfter }, ...list],
      };
    });
  };

  const associateSpaceWithGroup = (name: string, groupId: string) => {
    const key = name.toLowerCase().trim();
    setSpaceGroupByName((prev) => ({ ...prev, [key]: groupId }));
  };

  const unlinkSpaceFromGroup = (name: string) => {
    const key = name.toLowerCase().trim();
    setSpaceGroupByName((prev) => {
      const groupId = prev[key];
      if (groupId) {
        setGroupExtraSpaces((gprev) => ({
          ...gprev,
          [groupId]: (gprev[groupId] ?? []).filter(
            (s) => s.name.toLowerCase().trim() !== key
          ),
        }));
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isNameInGroupSuggestions = (name: string, groupId: string) => {
    const key = name.toLowerCase().trim();
    const group = ONBOARDING_SPACE_GROUPS.find((g) => g.id === groupId);
    return group?.suggestedSpaces.some((s) => s.toLowerCase().trim() === key) ?? false;
  };

  const addSpaceToGroupCard = (
    name: string,
    groupId: string,
    extra = false,
    insertAfter?: string
  ) => {
    associateSpaceWithGroup(name, groupId);
    if (extra || !isNameInGroupSuggestions(name, groupId)) {
      addToGroupExtraSpaces(groupId, name, insertAfter ? { insertAfter } : undefined);
    }
  };

  const isStaticSuggestionName = (nameKey: string) =>
    ONBOARDING_SPACE_GROUPS.some((g) =>
      g.suggestedSpaces.some((s) => s.toLowerCase().trim() === nameKey)
    );

  const resolveOriginalSuggestionKey = (
    nameKey: string,
    overrides: SuggestionLabelOverrides
  ): string | null => {
    if (isStaticSuggestionName(nameKey)) return nameKey;
    for (const [sourceKey, label] of Object.entries(overrides)) {
      if (label.toLowerCase().trim() === nameKey) return sourceKey;
    }
    return null;
  };

  const clearSuggestionLabelOverride = (nameKey: string) => {
    setSuggestionLabelOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [sourceKey, label] of Object.entries(prev)) {
        if (sourceKey === nameKey || label.toLowerCase().trim() === nameKey) {
          delete next[sourceKey];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const handleRemoveSpace = (index: number) => {
    const removed = spaces[index];
    if (!removed) return;
    const key = removed.toLowerCase().trim();
    const areaId = spaceAreaByNameKey[key];
    if (areaId) {
      setSpacesByAreaId((prev) => ({
        ...prev,
        [areaId]: (prev[areaId] ?? []).filter((s) => s.toLowerCase().trim() !== key),
      }));
    }
    unlinkSpaceFromGroup(removed);
    clearSuggestionLabelOverride(key);
    setSubSpacesByParent((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRemoveSpaceByName = (name: string) => {
    const key = name.toLowerCase().trim();
    const index = spaces.findIndex((s) => s.toLowerCase().trim() === key);
    if (index >= 0) handleRemoveSpace(index);
  };

  const openRenameModal = (name: string) => {
    setRenameModal({ currentName: name });
    setRenameModalInput(name);
  };

  const closeRenameModal = () => {
    setRenameModal(null);
    setRenameModalInput("");
  };

  const confirmRenameSpace = () => {
    if (!renameModal) return;
    const trimmed = renameModalInput.trim();
    if (!trimmed) return;
    const oldKey = renameModal.currentName.toLowerCase().trim();
    const newKey = trimmed.toLowerCase().trim();
    if (newKey !== oldKey && allSpaceNames.some((s) => s.toLowerCase().trim() === newKey)) {
      toast.error("Space already added");
      return;
    }
    setSpacesByAreaId((prev) => {
      const next: Record<string, string[]> = {};
      for (const [areaId, list] of Object.entries(prev)) {
        next[areaId] = list.map((s) => (s.toLowerCase().trim() === oldKey ? trimmed : s));
      }
      return next;
    });
    setSubSpacesByParent((prev) => {
      if (!prev[oldKey]) return prev;
      const next = { ...prev };
      next[newKey] = next[oldKey];
      delete next[oldKey];
      return next;
    });
    setSpaceGroupByName((prev) => {
      const groupId = prev[oldKey];
      if (!groupId) return prev;
      const next = { ...prev };
      delete next[oldKey];
      next[newKey] = groupId;
      return next;
    });
    setGroupExtraSpaces((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const groupId of Object.keys(next)) {
        const updated = next[groupId].map((s) => {
          const nextItem = { ...s };
          if (s.name.toLowerCase().trim() === oldKey) nextItem.name = trimmed;
          if (s.insertAfter?.toLowerCase().trim() === oldKey) nextItem.insertAfter = trimmed;
          return nextItem;
        });
        if (updated.some((s, i) => s.name !== next[groupId][i].name || s.insertAfter !== next[groupId][i].insertAfter)) {
          next[groupId] = updated;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setSuggestionLabelOverrides((prev) => {
      const sourceKey = resolveOriginalSuggestionKey(oldKey, prev);
      if (!sourceKey) return prev;
      return { ...prev, [sourceKey]: trimmed };
    });
    closeRenameModal();
  };

  const handleAddSubSpace = (parentSpace: string, subSpaceName: string) => {
    const key = parentSpace.toLowerCase().trim();
    setSubSpacesByParent((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), subSpaceName],
    }));
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (!activeAreaId) {
      toast.error("Select a property area first");
      return;
    }
    const key = suggestion.toLowerCase();
    if (spaces.some((s) => s.toLowerCase() === key)) {
      const ownerAreaId = spaceAreaByNameKey[key];
      if (ownerAreaId && ownerAreaId !== activeAreaId) {
        openCopyModal(suggestion);
        return;
      }
      return;
    }
    addSpaceToActiveArea(suggestion);
  };

  const handleAddSuggestionFromGroup = (
    suggestion: string,
    groupId: string,
    extra = false
  ) => {
    if (!activeAreaId) {
      toast.error("Select a property area first");
      return;
    }
    const key = suggestion.toLowerCase().trim();
    if (spaces.some((s) => s.toLowerCase() === key)) {
      const ownerAreaId = spaceAreaByNameKey[key];
      if (ownerAreaId && ownerAreaId !== activeAreaId) {
        openCopyModal(suggestion, groupId);
        return;
      }
      return;
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    if (!addSpaceToActiveArea(suggestion)) return;
    addSpaceToGroupCard(suggestion, groupId, extra);
  };

  const allSpaceNames = useMemo(
    () => [...spaces, ...Object.values(subSpacesByParent).flat()],
    [spaces, subSpacesByParent]
  );

  const getSuggestedCopyName = (baseName: string): string => {
    const base = baseName.trim();
    const baseLower = base.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${baseLower}(?:\\s+(\\d+))?$`, "i");
    let maxNum = 0;
    for (const name of allSpaceNames) {
      const m = name.trim().match(re);
      if (m) {
        const n = m[1] ? parseInt(m[1], 10) : 1;
        if (n > maxNum) maxNum = n;
      }
    }
    return `${base} ${maxNum + 1}`;
  };

  const resolveSpaceGroupId = (name: string, explicitGroupId?: string): string | undefined => {
    if (explicitGroupId) return explicitGroupId;
    const key = name.toLowerCase().trim();
    if (spaceGroupByName[key]) return spaceGroupByName[key];

    const groupsWithExtra = ONBOARDING_SPACE_GROUPS.filter((g) =>
      (groupExtraSpaces[g.id] ?? []).some((s) => s.name.toLowerCase().trim() === key)
    );
    if (groupsWithExtra.length === 1) return groupsWithExtra[0].id;

    const customGroupsWithExtra = customCollections.filter((c) =>
      (groupExtraSpaces[c.id] ?? []).some((s) => s.name.toLowerCase().trim() === key)
    );
    if (customGroupsWithExtra.length === 1) return customGroupsWithExtra[0].id;

    const groupsWithSuggestion = ONBOARDING_SPACE_GROUPS.filter((g) =>
      g.suggestedSpaces.some((s) => s.toLowerCase().trim() === key)
    );
    if (groupsWithSuggestion.length === 1) return groupsWithSuggestion[0].id;

    return undefined;
  };

  const openCopyModal = (name: string, groupId?: string) => {
    const suggested = getSuggestedCopyName(name);
    setCopyModal({ baseName: name, suggestedName: suggested, groupId });
    setCopyModalInput(suggested);
  };

  const closeCopyModal = () => {
    setCopyModal(null);
    setCopyModalInput("");
  };

  const confirmCopySpace = () => {
    if (!copyModal) return;
    const trimmed = copyModalInput.trim();
    if (!trimmed) return;
    if (allSpaceNames.some((s) => s.toLowerCase().trim() === trimmed.toLowerCase())) {
      toast.error("Space already added");
      return;
    }
    if (allSpaceNames.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    if (!addSpaceToActiveArea(trimmed)) return;
    const groupId = resolveSpaceGroupId(copyModal.baseName, copyModal.groupId);
    if (groupId) {
      addSpaceToGroupCard(trimmed, groupId, true, copyModal.baseName);
    }
    closeCopyModal();
  };

  const navigateAfterAddSpaces = async () => {
    const nextRoute = getPostAddSpacesRoute(propertyProfile);
    if (nextRoute) {
      navigate(nextRoute);
      return;
    }
    await finishOwnerOnboarding(navigate);
  };

  const handleSave = async () => {
    if (!propertyId) {
      toast.error("Property not found");
      return;
    }

    if (areas.length === 0) {
      toast.error("Please add at least one property area");
      return;
    }

    if (spaces.length === 0) {
      toast.error("Please add at least one space to an area");
      return;
    }

    setLoading(true);
    try {
      const areaRows = areas.map((a) => ({
        name: a.name,
        org_id: orgId!,
        property_id: propertyId,
        parent_space_id: null as string | null,
      }));

      const { data: insertedAreas, error: areaError } = await supabase
        .from("spaces")
        .insert(areaRows)
        .select("id, name");

      if (areaError) throw areaError;

      const areaIdByName = new Map(
        (insertedAreas ?? []).map((row) => [row.name.toLowerCase().trim(), row.id])
      );

      const childRows: {
        name: string;
        org_id: string;
        property_id: string;
        parent_space_id: string;
      }[] = [];

      for (const area of areas) {
        const parentId = areaIdByName.get(area.name.toLowerCase().trim());
        if (!parentId) continue;
        for (const spaceName of spacesByAreaId[area.id] ?? []) {
          childRows.push({
            name: spaceName,
            org_id: orgId!,
            property_id: propertyId,
            parent_space_id: parentId,
          });
        }
      }

      if (childRows.length > 0) {
        const { error: spaceError } = await supabase.from("spaces").insert(childRows);
        if (spaceError) throw spaceError;
      }

      const total = areas.length + childRows.length;
      toast.success(`${total} space${total > 1 ? "s" : ""} added!`);
      await navigateAfterAddSpaces();
    } catch (error: any) {
      toast.error(error.message || "Failed to add spaces");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    void navigateAfterAddSpaces();
  };

  const handleCreateCustomCollection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createCustomCollectionId();
    setCustomCollections((prev) => [...prev, { id, name: trimmed }]);
    setGroupExtraSpaces((prev) => ({ ...prev, [id]: [] }));
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSpace();
    }
  };

  const handleUploadPlans = async () => {
    if (!propertyId) {
      toast.error("Property not found yet. Please try again in a moment.");
      return;
    }
    if (!planFiles || planFiles.length === 0) {
      toast.error("Choose one or more plan files first");
      return;
    }
    try {
      const uploaded = await plans.uploadPlans(Array.from(planFiles));
      setPlanFiles(null);
      toast.success(`${uploaded.length} plan file(s) uploaded`);
      plans.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload plans");
    }
  };

  // Single source of truth: selected spaces. Derived set for fast lookup (card chips disable when selected).
  const selectedSpacesSet = useMemo(
    () => new Set(spaces.map((s) => s.toLowerCase().trim())),
    [spaces]
  );

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots />
        
        {(organization || propertyName) && (
          <OnboardingBreadcrumbs
            items={[
              ...(organization ? [{ label: organization.name }] : []),
              ...(propertyName ? [{ label: propertyName, active: true }] : [])
            ]}
          />
        )}
        
        <div className="mb-[10px] mt-[33px] flex flex-col items-center">
          <img
            src={addAreasSpacesIcon}
            alt=""
            aria-hidden
            className="h-16 w-16 object-contain drop-shadow-sm sm:h-[72px] sm:w-[72px]"
          />
        </div>

        <OnboardingHeader
          title="Add areas & spaces"
          subtitle={
            hasExistingSpaces
              ? "Areas are the main zones of your property (floors, outside). Spaces are the rooms and places inside each area — Filla uses both to organise tasks, schedules, and records."
              : "Areas are floors and zones. Spaces are rooms inside an area. Pick areas first, then add spaces to the active area."
          }
          showLogout={false}
        />

        {SHOW_PROPERTY_PLANS_PANEL && (
        <div className="mb-6 rounded-xl bg-card/60 p-4 shadow-e1">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Add property plans (optional)</h3>
              <p className="text-xs text-muted-foreground">
                Upload PDFs or images now. Files are linked to this property for plan extraction.
              </p>
            </div>
            {plans.files.length > 0 ? (
              <span className="text-xs text-muted-foreground">{plans.files.length} uploaded</span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              onChange={(e) => setPlanFiles(e.target.files)}
              className="w-full text-sm"
            />
            <button
              type="button"
              onClick={handleUploadPlans}
              disabled={!propertyId || plans.isUploading}
              className="h-10 px-4 rounded-xl text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {plans.isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Add Property Plans
            </button>
          </div>
        </div>
        )}

        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        {/* Property Areas card first; space groups unlock after an area is selected */}
        <SpaceGroupCarousel
          className="mb-4 rounded-tr-xl rounded-bl-xl"
          onScroll={(e) => {
            if (e.currentTarget.scrollLeft > 12) {
              setInstructionOpacity(0);
              if (instructionFadeRef.current) clearTimeout(instructionFadeRef.current);
              window.setTimeout(() => setShowAddSpacesInstruction(false), 400);
            }
          }}
        >
              <OnboardingPropertyAreasCard
                areas={areas}
                activeAreaId={activeAreaId}
                spaceCounts={spaceCounts}
                onSelectArea={handleSelectArea}
                onActivateArea={handleActivateArea}
                onRemoveArea={handleRemoveArea}
                onRenameArea={openRenameArea}
              />
              {ONBOARDING_SPACE_GROUPS.map((group, index) => (
              <OnboardingSpaceGroupCard
                key={group.id}
                group={group}
                selectedSpacesSet={selectedSpacesSet}
                selectedSpaceColors={selectedSpaceColors}
                spaceAreaByNameKey={spaceAreaByNameKey}
                activeAreaId={activeAreaId}
                extraSpaces={groupExtraSpaces[group.id] ?? []}
                suggestionLabelOverrides={suggestionLabelOverrides}
                subSpacesByParent={subSpacesByParent}
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
                onAddSpace={(name, extra) =>
                  handleAddSuggestionFromGroup(name, group.id, extra)
                }
                onRemoveSpace={handleRemoveSpaceByName}
                onRenameSpace={openRenameModal}
                onCopySpace={openCopyModal}
                onAddSubSpace={handleAddSubSpace}
              />
            ))}
            {customCollections.map((collection) => (
              <OnboardingCustomCollectionCard
                key={collection.id}
                collection={collection}
                selectedSpacesSet={selectedSpacesSet}
                extraSpaces={groupExtraSpaces[collection.id] ?? []}
                subSpacesByParent={subSpacesByParent}
                onAddSpace={(name, extra) =>
                  handleAddSuggestionFromGroup(name, collection.id, extra ?? true)
                }
                onRemoveSpace={handleRemoveSpaceByName}
                onRenameSpace={openRenameModal}
                onCopySpace={openCopyModal}
                onAddSubSpace={handleAddSubSpace}
                onUpdateCollection={handleUpdateCustomCollection}
              />
            ))}
            <OnboardingCustomCollectionDraftCard
              onCreateCollection={handleCreateCustomCollection}
            />
        </SpaceGroupCarousel>

        {areas.length > 0 ? (
          <div className="mb-4 space-y-3">
            <div>
              <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                Your areas
              </p>
              <SortableContext
                items={areas.map((a) => areaSortableId(a.id))}
                strategy={horizontalListSortingStrategy}
              >
              <div className="flex flex-wrap gap-[5px]">
                {areas.map((area) => {
                  const count = (spacesByAreaId[area.id] ?? []).length;
                  const isActive = activeAreaId === area.id;
                  return (
                    <SortableItem
                      key={area.id}
                      id={areaSortableId(area.id)}
                      data={{ kind: "area", areaId: area.id }}
                    >
                      <DroppableZone id={`area-drop:${area.id}`}>
                        <ExpandableSpaceChip
                          variant="area"
                          label={`${shortAreaLabel(area.name).toUpperCase()} · ${count}`}
                          color={isActive ? area.color : hexToRgba(area.color, 0.42)}
                          subSpaces={[]}
                          onRemove={() => handleRemoveArea(area.id)}
                          onAddSubSpace={() => undefined}
                          onRename={() => openRenameArea(area.id)}
                          onView={() => handleActivateArea(area.id)}
                          onPress={() => handleActivateArea(area.id)}
                          className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                        />
                      </DroppableZone>
                    </SortableItem>
                  );
                })}
              </div>
              </SortableContext>
            </div>

            {viewingArea ? (
              <div>
                <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                  {areaSpacesRowLabel(viewingArea.name)}
                </p>
                <DroppableZone id={spacesListDroppableId()}>
                <SortableContext
                  items={(spacesByAreaId[viewingArea.id] ?? []).map((s) =>
                    spaceSortableId(viewingArea.id, s)
                  )}
                  strategy={horizontalListSortingStrategy}
                >
                <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
                  {(spacesByAreaId[viewingArea.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-1.5">
                      Drop spaces here, or pick them from the cards above.
                    </p>
                  ) : (
                    (spacesByAreaId[viewingArea.id] ?? []).map((space) => (
                      <SortableItem
                        key={space}
                        id={spaceSortableId(viewingArea.id, space)}
                        data={{
                          kind: "space",
                          spaceName: space,
                          areaId: viewingArea.id,
                        }}
                      >
                        <ExpandableSpaceChip
                          label={shortSpaceLabel(space)}
                          color={viewingArea.color}
                          subSpaces={
                            subSpacesByParent[space.toLowerCase().trim()] ?? []
                          }
                          onRemove={() => handleRemoveSpaceByName(space)}
                          onAddSubSpace={(name) => handleAddSubSpace(space, name)}
                          onRename={() => openRenameModal(space)}
                          onDuplicate={() => openCopyModal(space)}
                          onPress={() => handleRemoveSpaceByName(space)}
                          className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                        />
                      </SortableItem>
                    ))
                  )}
                </div>
                </SortableContext>
                </DroppableZone>
              </div>
            ) : null}
          </div>
        ) : null}
        <DragOverlay>
          {activeDrag ? (
            <div className="rounded-[8px] bg-card px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wide shadow-e2">
              {activeDrag.kind === "area"
                ? areas.find((a) => a.id === activeDrag.areaId)?.name ?? "Area"
                : activeDrag.kind === "space"
                  ? activeDrag.spaceName
                  : activeDrag.spaceName}
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>

        {/* Input field */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <NeomorphicInput
                ref={spaceInputRef}
                placeholder={
                  activeArea
                    ? `Enter space name for ${activeArea.name}…`
                    : "Select an area first…"
                }
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={areas.length === 0}
              />
            </div>
            <button
              type="button"
              onClick={handleAddSpace}
              disabled={!spaceName.trim() || !activeAreaId}
              className="h-12 w-12 flex-shrink-0 flex items-center justify-center px-4 rounded-xl bg-primary text-primary-foreground shadow-primary-btn transition-[transform,box-shadow,background-color] active:shadow-btn-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:!opacity-100"
              aria-label="Add space"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rename-space modal */}
        <Dialog open={!!renameModal} onOpenChange={(open) => !open && closeRenameModal()}>
          <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-mono uppercase tracking-wider">
                Rename space
              </DialogTitle>
            </DialogHeader>
            <input
              type="text"
              value={renameModalInput}
              onChange={(e) => setRenameModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmRenameSpace();
                }
                if (e.key === "Escape") closeRenameModal();
              }}
              placeholder="Space name"
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wider rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <NeomorphicButton variant="ghost" onClick={closeRenameModal}>
                Cancel
              </NeomorphicButton>
              <NeomorphicButton
                variant="primary"
                onClick={confirmRenameSpace}
                disabled={!renameModalInput.trim()}
              >
                Save
              </NeomorphicButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Copy-space modal: new name (e.g. Bedroom 2), editable or accept */}
        <Dialog open={!!copyModal} onOpenChange={(open) => !open && closeCopyModal()}>
          <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-mono uppercase tracking-wider">
                New space name
              </DialogTitle>
            </DialogHeader>
            <input
              type="text"
              value={copyModalInput}
              onChange={(e) => setCopyModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmCopySpace();
                }
                if (e.key === "Escape") closeCopyModal();
              }}
              placeholder="e.g. Bedroom 2"
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wider rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <NeomorphicButton variant="ghost" onClick={closeCopyModal}>
                Cancel
              </NeomorphicButton>
              <NeomorphicButton
                variant="primary"
                onClick={confirmCopySpace}
                disabled={!copyModalInput.trim()}
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
                  confirmRenameArea();
                }
                if (e.key === "Escape") setRenameAreaModal(null);
              }}
              placeholder="Area name"
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wider rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <NeomorphicButton variant="ghost" onClick={() => setRenameAreaModal(null)}>
                Cancel
              </NeomorphicButton>
              <NeomorphicButton
                variant="primary"
                onClick={confirmRenameArea}
                disabled={!renameAreaInput.trim()}
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
                Delete area?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This area has {areaDeleteModal?.spaceCount ?? 0} spaces. You can transfer them
              to another area, or delete the area and its spaces.
            </p>
            {(areaDeleteModal?.spaceCount ?? 0) > 5 ? (
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wide text-amber-700">
                  Warning: more than 5 spaces
                </p>
                <label className="block text-xs text-muted-foreground">Transfer spaces to</label>
                <select
                  value={transferTargetAreaId}
                  onChange={(e) => setTransferTargetAreaId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select area…</option>
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
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <NeomorphicButton
                variant="primary"
                onClick={() => confirmDeleteArea("transfer")}
                disabled={!transferTargetAreaId}
              >
                Transfer & delete area
              </NeomorphicButton>
              <NeomorphicButton variant="ghost" onClick={() => confirmDeleteArea("delete")}>
                Delete area and spaces
              </NeomorphicButton>
              <NeomorphicButton variant="ghost" onClick={() => setAreaDeleteModal(null)}>
                Cancel
              </NeomorphicButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="pt-4 space-y-3">
          <NeomorphicButton
            variant="primary"
            onClick={handleSave}
            disabled={loading || spaces.length === 0 || areas.length === 0 || !propertyId}
          >
            {loading ? "Saving…" : "Continue"}
          </NeomorphicButton>

          <NeomorphicButton
            variant="ghost"
            onClick={handleSkip}
          >
            Skip for now
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>
  );
}
