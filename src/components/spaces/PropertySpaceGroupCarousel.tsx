import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  type SuggestionLabelOverrides,
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
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { isFuzzyMatchSimilarity } from "@/services/ai/fuzzyMatch";
import { resolveSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";

type PropertySpaceGroupCarouselProps = {
  propertyId: string;
  className?: string;
  /** Filters space chips across group cards (case-insensitive). */
  spaceFilter?: string;
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
  spaceFilter = "",
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
      spaces.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
    );
    for (const pins of Object.values(pendingPinsByGroup)) {
      for (const name of pins) {
        const key = name.toLowerCase().trim();
        if (key) set.add(key);
      }
    }
    return set;
  }, [spaces, pendingPinsByGroup]);

  useEffect(() => {
    const existing = new Set(
      spaces.map((s) => (s.name ?? "").toLowerCase().trim()).filter(Boolean)
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
  }, [spaces]);

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
    const sorted = [...spaces].sort(
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
  }, [spaces, spaceToCollection, pendingPinsByGroup]);

  const extraSpacesByGroup = useMemo(() => {
    const result: Record<string, GroupExtraSpace[]> = {};
    const sorted = [...spaces].sort(
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
  }, [spaces, spaceToCollection, pendingPinsByGroup]);

  const filterKey = spaceFilter.trim().toLowerCase();

  const groupMatchesFilter = useCallback(
    (groupId: string, suggestedSpaces: string[] = []) => {
      if (!filterKey) return true;
      const selected = selectedSpacesNewestFirstByGroup[groupId] ?? [];
      if (selected.some((n) => n.toLowerCase().includes(filterKey))) return true;
      return suggestedSpaces.some((n) => n.toLowerCase().includes(filterKey));
    },
    [filterKey, selectedSpacesNewestFirstByGroup]
  );

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
    for (const space of spaces) {
      const key = (space.name ?? "").toLowerCase().trim();
      if (!key || handlers[key]) continue;
      const spaceId = space.id;
      handlers[key] = () => {
        navigate(`/properties/${propertyId}/spaces/${spaceId}`);
      };
    }
    return handlers;
  }, [spaces, navigate, propertyId]);

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
      navigate(`/properties/${propertyId}/spaces/${space.id}`);
    },
    [viewSpaceByNameKey, findSpaceByName, navigate, propertyId]
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
      });
      if (error) throw error;
      // Persist group membership for custom names (and suggestions) so chips
      // survive refresh — resolveSpaceGroupId needs this when there's no space_type.
      assignSpaceToCollection(trimmed, groupId);
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

  const removeSpace = async (name: string) => {
    const space = findSpaceByName(name);
    if (!space) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("spaces").delete().eq("id", space.id);
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

  return (
    <>
      <SpaceGroupCarousel className={className}>
        {ONBOARDING_SPACE_GROUPS.filter((group) =>
          groupMatchesFilter(group.id, group.suggestedSpaces)
        ).map((group) => (
          <OnboardingSpaceGroupCard
            key={group.id}
            group={group}
            selectedSpacesSet={selectedSpacesSet}
            extraSpaces={extraSpacesByGroup[group.id] ?? []}
            selectedSpacesNewestFirst={selectedSpacesNewestFirstByGroup[group.id] ?? []}
            spaceFilter={spaceFilter}
            suggestionLabelOverrides={suggestionLabelOverrides}
            onAddSpace={(name) => createSpace(name, group.id)}
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
        {customCollections
          .filter((collection) => groupMatchesFilter(collection.id))
          .map((collection) => (
            <OnboardingCustomCollectionCard
              key={collection.id}
              collection={collection}
              selectedSpacesSet={selectedSpacesSet}
              extraSpaces={extraSpacesByGroup[collection.id] ?? []}
              spaceFilter={spaceFilter}
              onAddSpace={(name) => createSpace(name, collection.id)}
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
          <OnboardingCustomCollectionDraftCard onCreateCollection={handleCreateCustomCollection} />
        ) : null}
      </SpaceGroupCarousel>

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
    </>
  );
}
