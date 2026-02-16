import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import {
  getSpaceGroupById,
  shortSpaceLabel,
} from "@/components/onboarding/onboardingSpaceGroups";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { ExpandableFactChip } from "@/components/chips/ExpandableFactChip";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Space Group Screen - Template for all space groups (Circulation, Service Areas, etc.)
 * Same layout: 245px left (recent spaces), 650px right (group panel + add flow).
 */
export default function SpaceGroupScreen() {
  const { id: propertyId, groupSlug } = useParams<{
    id: string;
    groupSlug: string;
  }>();
  const navigate = useNavigate();
  const { property, loading: propertyLoading } = useProperty(propertyId);
  const { data: tasksData = [] } = useTasksQuery(propertyId);
  const { orgId } = useActiveOrg();

  const group = groupSlug ? getSpaceGroupById(groupSlug) : undefined;

  const [spaceName, setSpaceName] = useState("");
  const [spaces, setSpaces] = useState<string[]>([]);
  const [subSpacesByParent, setSubSpacesByParent] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [copyModal, setCopyModal] = useState<{
    baseName: string;
    suggestedName: string;
  } | null>(null);
  const [copyModalInput, setCopyModalInput] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces:
        typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [],
      themes:
        typeof task.themes === "string" ? JSON.parse(task.themes) : task.themes || [],
      teams:
        typeof task.teams === "string" ? JSON.parse(task.teams) : task.teams || [],
    }));
  }, [tasksData]);

  const selectedSpacesSet = useMemo(
    () => new Set(spaces.map((s) => s.toLowerCase().trim())),
    [spaces]
  );

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

  const handleAddSpace = () => {
    const trimmed = spaceName.trim();
    if (!trimmed) return;
    if (spaces.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Space already added");
      return;
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, trimmed]);
    setSpaceName("");
  };

  const handleRemoveSpace = (index: number) => {
    const removed = spaces[index];
    setSpaces(spaces.filter((_, i) => i !== index));
    if (removed) {
      const key = removed.toLowerCase().trim();
      setSubSpacesByParent((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleAddSubSpace = (parentSpace: string, subSpaceName: string) => {
    const key = parentSpace.toLowerCase().trim();
    setSubSpacesByParent((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), subSpaceName],
    }));
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (selectedSpacesSet.has(suggestion.toLowerCase().trim())) return;
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, suggestion]);
  };

  const openCopyModal = (name: string) => {
    setCopyModal({ baseName: name, suggestedName: getSuggestedCopyName(name) });
    setCopyModalInput(getSuggestedCopyName(name));
  };

  const closeCopyModal = () => {
    setCopyModal(null);
    setCopyModalInput("");
  };

  const confirmCopySpace = () => {
    if (!copyModal) return;
    const trimmed = copyModalInput.trim();
    if (!trimmed) return;
    if (
      allSpaceNames.some(
        (s) => s.toLowerCase().trim() === trimmed.toLowerCase()
      )
    ) {
      toast.error("Space already added");
      return;
    }
    if (allSpaceNames.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, trimmed]);
    closeCopyModal();
  };

  const handleSave = async () => {
    if (!propertyId || !orgId) {
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

      const { error } = await supabase.from("spaces").insert(spacesToInsert);
      if (error) throw error;

      toast.success(
        `${allNames.length} space${allNames.length > 1 ? "s" : ""} added!`
      );
      navigate(`/properties/${propertyId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add spaces");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSpace();
    }
  };

  const handleBack = () => {
    navigate(`/properties/${propertyId}/spaces/organise`);
  };

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  useEffect(() => {
    if (!propertyLoading && propertyId && groupSlug && !group) {
      toast.error("Space group not found");
      navigate(`/properties/${propertyId}/spaces/organise`);
    }
  }, [group, groupSlug, propertyId, propertyLoading, navigate]);

  if (!group) {
    return <LoadingState />;
  }

  const header = (
    <PageHeader>
      <div className="px-4 pt-[63px] pb-[18px] h-[100px] flex items-center justify-between rounded-bl-[12px] bg-primary/10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground leading-tight">
              {group.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {property
                ? `${property.nickname || property.address}`
                : "Add spaces for this group"}
            </p>
          </div>
        </div>
      </div>
    </PageHeader>
  );

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <DualPaneLayout
        header={header}
        leftColumn={
          <div className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full pl-0">
            {propertyId && (
              <PropertySpacesList
                propertyId={propertyId}
                tasks={tasks}
                onSpaceClick={setSelectedSpaceId}
                selectedSpaceId={selectedSpaceId}
              />
            )}
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto">
            <div className="p-[15px] space-y-6">
              {/* Single group slider panel - hover to reveal suggestions */}
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hover over the card to see suggested spaces. Click to add.
                </p>
                <div className="flex justify-start">
                  <OnboardingSpaceGroupCard
                    group={group}
                    selectedSpacesSet={selectedSpacesSet}
                    onAddSpace={handleAddSuggestion}
                    onCopySpace={openCopyModal}
                  />
                </div>
              </div>

              {/* Add custom space */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  Add custom space
                </h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NeomorphicInput
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
                    className="h-12 w-12 flex-shrink-0 flex items-center justify-center px-4 rounded-xl text-white transition-all disabled:!opacity-50"
                    style={{ backgroundColor: "#8EC9CE" }}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Your Spaces */}
              {spaces.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Your Spaces
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                    {spaces.length} space{spaces.length !== 1 ? "s" : ""} added
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spaces.map((space, index) => (
                      <ExpandableFactChip
                        key={`${space}-${index}`}
                        label={shortSpaceLabel(space)}
                        subSpaces={
                          subSpacesByParent[space.toLowerCase().trim()] ?? []
                        }
                        onRemove={() => handleRemoveSpace(index)}
                        onAddSubSpace={(name) =>
                          handleAddSubSpace(space, name)
                        }
                        className="!shadow-none"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Save */}
              <div className="pt-4">
                <NeomorphicButton
                  variant="primary"
                  onClick={handleSave}
                  disabled={loading || spaces.length === 0}
                  style={{ backgroundColor: "#8EC9CE" }}
                >
                  {loading ? "Saving..." : "Save spaces"}
                </NeomorphicButton>
              </div>
            </div>
          </div>
        }
      />

      {/* Copy-space modal */}
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
    </div>
  );
}
