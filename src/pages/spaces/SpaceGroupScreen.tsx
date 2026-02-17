import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { SpaceGroupIdentityCard } from "@/components/spaces/SpaceGroupIdentityCard";
import { SpaceGroupMiniCardsStrip } from "@/components/spaces/SpaceGroupMiniCardsStrip";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import {
  getSpaceGroupById,
  shortSpaceLabel,
} from "@/components/onboarding/onboardingSpaceGroups";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { FillaIcon } from "@/components/filla/FillaIcon";
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
 * Same layout as Property Detail: 245px left, 650px middle, third column concertina on wide screens.
 */
export default function SpaceGroupScreen() {
  const { id: propertyId, groupSlug } = useParams<{
    id: string;
    groupSlug: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"add-space" | "create" | "details" | "assistant" | null>("add-space");

  const { isOpen: assistantOpen, closeAssistant, openAssistant, assistantContext, messages, proposedAction, loading: assistantLoading, onSendMessage, onConfirmAction, onRejectAction } = useAssistantContext();

  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= 1380);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (assistantOpen && isLargeScreen) setExpandedSection("assistant");
  }, [assistantOpen, isLargeScreen]);

  useEffect(() => {
    if (expandedSection === "add-space") setShowAddSpace(true);
  }, [expandedSection]);

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

  // Must be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (!propertyLoading && propertyId && groupSlug && !group) {
      toast.error("Space group not found");
      navigate(`/properties/${propertyId}/spaces/organise`);
    }
  }, [group, groupSlug, propertyId, propertyLoading, navigate]);

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  if (!group) {
    return <LoadingState />;
  }

  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${group.color} 0%, ${group.color} 20%, transparent 70%, transparent 100%)`,
  };

  const header = (
    <PageHeader>
      <div
        className="px-4 pt-[63px] pb-[18px] h-[100px] flex items-center justify-between rounded-bl-[12px]"
        style={gradientStyle}
      >
        <div className="flex items-center gap-3 w-[248px]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="shrink-0 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white leading-tight">
              {group.label}
            </h1>
            <p className="text-sm text-white/80 mt-1">
              {property?.nickname || property?.address || "Add spaces"}
            </p>
          </div>
        </div>
        {propertyId && (
          <button
            onClick={() => openAssistant({ type: "property", id: propertyId, name: property?.nickname || property?.address || "Property" })}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Open Assistant"
          >
            <FillaIcon size={20} className="brightness-0 invert" />
          </button>
        )}
      </div>
    </PageHeader>
  );

  const thirdColumnContent = propertyId && groupSlug ? (
    <div className="flex flex-col pt-[100px] pr-2 pb-0 pl-2 min-h-0">
      <ThirdColumnConcertina
        sections={[
          {
            id: "add-space",
            title: "Add New Space",
            isExpanded: expandedSection === "add-space",
            onToggle: () => setExpandedSection((s) => (s === "add-space" ? null : "add-space")),
            children: (
              <AddSpaceDialog
                open={showAddSpace}
                onOpenChange={(open) => {
                  setShowAddSpace(open);
                  if (!open) setExpandedSection(null);
                }}
                properties={property ? [property] : []}
                propertyId={propertyId}
                variant="column"
                headless
              />
            ),
          },
          {
            id: "create",
            title: "Create Task",
            isExpanded: expandedSection === "create",
            onToggle: () => setExpandedSection((s) => (s === "create" ? null : "create")),
            children: (
              <CreateTaskModal
                open={showCreateTask}
                onOpenChange={(open) => {
                  setShowCreateTask(open);
                  if (!open) setExpandedSection(null);
                }}
                onTaskCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["tasks", undefined, propertyId] });
                }}
                defaultPropertyId={propertyId}
                variant="column"
                headless
              />
            ),
          },
          {
            id: "details",
            title: selectedTaskId ? "Task Details" : "Task Details",
            isExpanded: expandedSection === "details",
            onToggle: () => setExpandedSection((s) => (s === "details" ? null : "details")),
            children: selectedTaskId ? (
              <TaskDetailPanel
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
                variant="column"
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Select a task to view details
              </div>
            ),
          },
          {
            id: "assistant",
            title: "Filla AI",
            isExpanded: expandedSection === "assistant",
            onToggle: () => {
              if (expandedSection === "assistant") {
                closeAssistant();
                setExpandedSection(null);
              } else {
                setExpandedSection("assistant");
              }
            },
            children: (
              <AssistantPanelBody
                context={assistantContext}
                messages={messages}
                proposedAction={proposedAction}
                loading={assistantLoading}
                onSendMessage={onSendMessage}
                onConfirmAction={onConfirmAction}
                onRejectAction={onRejectAction}
                showContextHeader={true}
                className="min-h-[200px]"
              />
            ),
          },
        ]}
      />
    </div>
  ) : undefined;

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <DualPaneLayout
        header={header}
        leftColumn={
          <div className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full pl-0">
            <SpaceGroupIdentityCard
              group={group}
              propertyName={property?.nickname || property?.address}
              onAddTask={() => {
                if (isLargeScreen) {
                  setSelectedTaskId(null);
                  setShowCreateTask(true);
                  setExpandedSection("create");
                } else {
                  setShowCreateTask(true);
                }
              }}
            />
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto">
            {/* Mini space cards at top */}
            {propertyId && groupSlug && group?.color && (
              <div className="px-[15px] pt-[15px]">
                <SpaceGroupMiniCardsStrip
                  propertyId={propertyId}
                  groupSlug={groupSlug}
                  groupColor={group.color}
                  tasks={tasks}
                  onSpaceClick={setSelectedSpaceId}
                  selectedSpaceId={selectedSpaceId}
                />
              </div>
            )}

            <div className="p-[15px] space-y-6">
              {/* Add Space button - opens modal on narrow, concertina on wide */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Add spaces</h2>
                {!isLargeScreen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddSpace(true)}
                    className="text-primary hover:text-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add space
                  </Button>
                )}
              </div>

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
                      <ExpandableSpaceChip
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
        thirdColumn={thirdColumnContent}
      />

      {/* Add Space Modal - for narrow screens */}
      {showAddSpace && !isLargeScreen && (
        <AddSpaceDialog
          open={showAddSpace}
          onOpenChange={setShowAddSpace}
          properties={property ? [property] : []}
          propertyId={propertyId}
        />
      )}

      {/* Create Task Modal - for narrow screens */}
      {showCreateTask && !isLargeScreen && (
        <CreateTaskModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          onTaskCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", undefined, propertyId] });
          }}
          defaultPropertyId={propertyId}
          variant="modal"
        />
      )}

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
