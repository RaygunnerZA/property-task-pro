import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { OnboardingBreadcrumbs } from "@/components/onboarding/OnboardingBreadcrumbs";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
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
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganization } from "@/hooks/use-organization";
import { useBuildingPlans } from "@/hooks/property/useBuildingPlans";
import { getPostAddSpacesRoute } from "@/lib/propertyProfiles";
import { finishOwnerOnboarding } from "@/utils/completeOnboarding";
import { useOnboardingPropertyProfile } from "@/hooks/useOnboardingPropertyProfile";
import { toast } from "sonner";
import { Plus, Layers, FileUp, Loader2 } from "lucide-react";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
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
  const [spaces, setSpaces] = useState<string[]>([]);
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

  const handleAddSpace = () => {
    const trimmed = spaceName.trim();
    if (!trimmed) return;
    
    // Check for duplicates (case-insensitive)
    if (spaces.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Space already added");
      return;
    }

    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }

    setSpaces([...spaces, trimmed]);
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
      return {
        ...prev,
        [groupId]: [...list, { name: trimmed, insertAfter: options?.insertAfter }],
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
    setSpaces(spaces.filter((_, i) => i !== index));
    if (removed) {
      const key = removed.toLowerCase().trim();
      unlinkSpaceFromGroup(removed);
      clearSuggestionLabelOverride(key);
      setSubSpacesByParent((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
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
    setSpaces((prev) =>
      prev.map((s) => (s.toLowerCase().trim() === oldKey ? trimmed : s))
    );
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
    if (spaces.some(s => s.toLowerCase() === suggestion.toLowerCase())) {
      return; // Already added
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, suggestion]);
  };

  const handleAddSuggestionFromGroup = (
    suggestion: string,
    groupId: string,
    extra = false
  ) => {
    if (spaces.some((s) => s.toLowerCase() === suggestion.toLowerCase())) {
      return;
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    addSpaceToGroupCard(suggestion, groupId, extra);
    setSpaces([...spaces, suggestion]);
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
    const baseKey = copyModal.baseName.toLowerCase().trim();
    setSpaces((prev) => {
      const baseIndex = prev.findIndex((s) => s.toLowerCase().trim() === baseKey);
      if (baseIndex < 0) return [...prev, trimmed];
      const next = [...prev];
      next.splice(baseIndex + 1, 0, trimmed);
      return next;
    });
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

    if (spaces.length === 0) {
      toast.error("Please add at least one space");
      return;
    }

    setLoading(true);
    try {
      const allNames = [...spaces, ...Object.values(subSpacesByParent).flat()];
      const spacesToInsert = allNames.map((name) => ({
        name,
        org_id: orgId,
        property_id: propertyId,
      }));

      const { error } = await supabase
        .from('spaces')
        .insert(spacesToInsert);

      if (error) throw error;

      toast.success(`${allNames.length} space${allNames.length > 1 ? "s" : ""} added!`);
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

  const stepIconStyle = {
    ...paperTexturedColorStyle("#8EC9CE"),
    backgroundColor: "rgba(255, 255, 255, 1)",
    boxShadow:
      "2px 3px 3px 0px rgba(255, 255, 255, 0.75), -1px -1px 1px 1px rgba(0, 0, 0, 0.15), inset 1px 3px 3px 0px rgba(0, 0, 0, 0.15)",
  } as const;

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
        
        {/* Spaces icon above title — matches Add Property step icon */}
        <div className="flex flex-col items-center mt-[33px] mb-[10px]">
          <div
            className="paper-textured-color relative overflow-hidden p-4 rounded-2xl"
            style={stepIconStyle}
          >
            <Layers className="relative z-10 w-10 h-10 text-white drop-shadow-sm" />
          </div>
        </div>

        <OnboardingHeader
          title="Add spaces"
          subtitle={hasExistingSpaces 
            ? "Spaces are the areas inside your property. Filla uses them to organise tasks, schedules, and records."
            : "Define areas within your property"
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
              style={{ backgroundColor: "#8EC9CE" }}
            >
              {plans.isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Add Property Plans
            </button>
          </div>
        </div>
        )}

        {/* Space group cards: hover to reveal ghost chips; click chip to add to main chip row */}
        <SpaceGroupCarousel className="mb-6 rounded-tr-xl rounded-bl-xl">
              {ONBOARDING_SPACE_GROUPS.map((group) => (
              <OnboardingSpaceGroupCard
                key={group.id}
                group={group}
                selectedSpacesSet={selectedSpacesSet}
                extraSpaces={groupExtraSpaces[group.id] ?? []}
                suggestionLabelOverrides={suggestionLabelOverrides}
                subSpacesByParent={subSpacesByParent}
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

        {/* Input field */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <NeomorphicInput
                ref={spaceInputRef}
                placeholder="Enter space name..."
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              type="button"
              onClick={handleAddSpace}
              disabled={!spaceName.trim()}
              className="h-12 w-12 flex-shrink-0 flex items-center justify-center px-4 rounded-xl text-white transition-all disabled:!opacity-100"
              style={{
                backgroundColor: "#8EC9CE"
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rename-space modal */}
        <Dialog open={!!renameModal} onOpenChange={(open) => !open && closeRenameModal()}>
          <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-mono uppercase tracking-wide">
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
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wide rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
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
                style={{ backgroundColor: "#8EC9CE" }}
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
              <DialogTitle className="text-base font-mono uppercase tracking-wide">
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
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wide rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
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
                style={{ backgroundColor: "#8EC9CE" }}
              >
                Add
              </NeomorphicButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Your Spaces – expandable fact chips with chevron dropdown (sub-spaces, + Sub-space, X | More) */}
        {spaces.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-[#6D7480] mb-2 font-mono uppercase tracking-wide">Your Spaces</p>
            <div className="flex flex-wrap gap-2">
              {spaces.map((space, index) => (
                <ExpandableSpaceChip
                  key={`${space}-${index}`}
                  label={shortSpaceLabel(space)}
                  subSpaces={subSpacesByParent[space.toLowerCase().trim()] ?? []}
                  onRemove={() => handleRemoveSpace(index)}
                  onAddSubSpace={(name) => handleAddSubSpace(space, name)}
                  onRename={() => openRenameModal(space)}
                  onDuplicate={() => openCopyModal(space)}
                  className="!shadow-none"
                />
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 space-y-3">
          <NeomorphicButton
            variant="primary"
            onClick={handleSave}
            disabled={loading || spaces.length === 0 || !propertyId}
            style={{ backgroundColor: "#8EC9CE" }}
          >
            {loading ? "Saving..." : "Continue"}
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
