import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSpacesWithTypes, type SpaceWithType } from "@/hooks/useSpacesWithTypes";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import { OnboardingCustomCollectionCard } from "@/components/onboarding/OnboardingCustomCollectionCard";
import { OnboardingCustomCollectionDraftCard } from "@/components/onboarding/OnboardingCustomCollectionDraftCard";
import {
  ONBOARDING_SPACE_GROUPS,
  getGroupIdFromDefaultUiGroup,
  getSpaceGroupById,
  isCustomCollectionGroupId,
  type GroupExtraSpace,
  type OnboardingCustomCollection,
} from "@/components/onboarding/onboardingSpaceGroups";
import {
  createPropertyCustomCollection,
  loadPropertyCustomSpaceGroups,
  savePropertyCustomSpaceGroups,
} from "@/lib/propertyCustomSpaceGroupsStorage";
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

type PropertySpaceGroupCarouselProps = {
  propertyId: string;
  className?: string;
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
    return getGroupIdFromDefaultUiGroup(defaultUiGroup);
  }
  const name = space.name?.trim();
  if (!name) return undefined;
  const matching = ONBOARDING_SPACE_GROUPS.filter((g) =>
    g.suggestedSpaces.some((s) => s.toLowerCase() === name.toLowerCase())
  );
  return matching.length === 1 ? matching[0].id : undefined;
}

function isSuggestionForGroup(name: string, groupId: string): boolean {
  const group = getSpaceGroupById(groupId);
  if (!group) return false;
  const key = name.toLowerCase().trim();
  return group.suggestedSpaces.some((s) => s.toLowerCase().trim() === key);
}

export function PropertySpaceGroupCarousel({
  propertyId,
  className,
}: PropertySpaceGroupCarouselProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { spaces, refresh } = useSpacesWithTypes(propertyId);

  const [renameModal, setRenameModal] = useState<{ spaceId: string; currentName: string } | null>(
    null
  );
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
  const skipPersistCustomGroupsRef = useRef(true);

  useEffect(() => {
    skipPersistCustomGroupsRef.current = true;
    const stored = loadPropertyCustomSpaceGroups(propertyId);
    setCustomCollections(stored.collections);
    setSpaceToCollection(stored.spaceToCollection);
    queueMicrotask(() => {
      skipPersistCustomGroupsRef.current = false;
    });
  }, [propertyId]);

  useEffect(() => {
    if (skipPersistCustomGroupsRef.current) return;
    savePropertyCustomSpaceGroups(propertyId, {
      collections: customCollections,
      spaceToCollection,
    });
  }, [propertyId, customCollections, spaceToCollection]);

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

  const selectedSpacesSet = useMemo(
    () => new Set(spaces.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)),
    [spaces]
  );

  const extraSpacesByGroup = useMemo(() => {
    const result: Record<string, GroupExtraSpace[]> = {};
    for (const space of spaces) {
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
    return result;
  }, [spaces, spaceToCollection]);

  const invalidateSpaces = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["spaces"] });
    await refresh();
  }, [queryClient, refresh]);

  const findSpaceByName = useCallback(
    (name: string) => {
      const key = name.toLowerCase().trim();
      return spaces.find((s) => (s.name ?? "").toLowerCase().trim() === key);
    },
    [spaces]
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

  const createSpace = async (name: string, groupId: string) => {
    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSpacesSet.has(trimmed.toLowerCase())) {
      toast.error("Space already exists");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("spaces").insert({
        org_id: orgId,
        property_id: propertyId,
        name: trimmed,
        icon_name: "box",
      });
      if (error) throw error;
      if (isCustomCollectionGroupId(groupId)) {
        assignSpaceToCollection(trimmed, groupId);
      }
      toast.success(`Added ${trimmed}`);
      await invalidateSpaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add space";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const removeSpace = async (name: string) => {
    const space = findSpaceByName(name);
    if (!space) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("spaces").delete().eq("id", space.id);
      if (error) throw error;
      unassignSpace(name);
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
    const newKey = trimmed.toLowerCase();
    const oldKey = renameModal.currentName.toLowerCase().trim();
    if (newKey !== oldKey && selectedSpacesSet.has(newKey)) {
      toast.error("Space already exists");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: trimmed })
        .eq("id", renameModal.spaceId);
      if (error) throw error;
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

  return (
    <>
      <SpaceGroupCarousel className={className}>
        {ONBOARDING_SPACE_GROUPS.map((group) => (
          <OnboardingSpaceGroupCard
            key={group.id}
            group={group}
            selectedSpacesSet={selectedSpacesSet}
            extraSpaces={extraSpacesByGroup[group.id] ?? []}
            onAddSpace={(name) => createSpace(name, group.id)}
            onRemoveSpace={removeSpace}
            onRenameSpace={(name) => {
              const space = findSpaceByName(name);
              if (!space) return;
              setRenameModal({ spaceId: space.id, currentName: name });
              setRenameInput(name);
            }}
            onCopySpace={(name, groupId) => {
              const suggested = getSuggestedCopyName(name);
              setCopyModal({ baseName: name, suggestedName: suggested, groupId });
              setCopyInput(suggested);
            }}
          />
        ))}
        {customCollections.map((collection) => (
          <OnboardingCustomCollectionCard
            key={collection.id}
            collection={collection}
            selectedSpacesSet={selectedSpacesSet}
            extraSpaces={extraSpacesByGroup[collection.id] ?? []}
            onAddSpace={(name) => createSpace(name, collection.id)}
            onRemoveSpace={removeSpace}
            onRenameSpace={(name) => {
              const space = findSpaceByName(name);
              if (!space) return;
              setRenameModal({ spaceId: space.id, currentName: name });
              setRenameInput(name);
            }}
            onCopySpace={(name, groupId) => {
              const suggested = getSuggestedCopyName(name);
              setCopyModal({ baseName: name, suggestedName: suggested, groupId });
              setCopyInput(suggested);
            }}
            onUpdateCollection={handleUpdateCustomCollection}
          />
        ))}
        <OnboardingCustomCollectionDraftCard onCreateCollection={handleCreateCustomCollection} />
      </SpaceGroupCarousel>

      <Dialog open={!!renameModal} onOpenChange={(open) => !open && setRenameModal(null)}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wide">
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
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wide outline-none focus:ring-2 focus:ring-ring"
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
              style={{ backgroundColor: "#8EC9CE" }}
            >
              Save
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!copyModal} onOpenChange={(open) => !open && setCopyModal(null)}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wide">
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
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wide outline-none focus:ring-2 focus:ring-ring"
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
              style={{ backgroundColor: "#8EC9CE" }}
            >
              Add
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
