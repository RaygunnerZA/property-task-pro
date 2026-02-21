import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { SpaceGroupIdentityCard } from "@/components/spaces/SpaceGroupIdentityCard";
import { SpaceGroupMiniCardsStrip } from "@/components/spaces/SpaceGroupMiniCardsStrip";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { SuggestedSpacesStrip } from "@/components/spaces/SuggestedSpacesStrip";
import { getSpaceGroupById } from "@/components/onboarding/onboardingSpaceGroups";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { toast } from "sonner";

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
  const group = groupSlug ? getSpaceGroupById(groupSlug) : undefined;

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
    <div className="flex flex-col pr-2 pb-0 pl-2 min-h-0">
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
              onSeeTasks={() => navigate(`/properties/${propertyId}?group=${groupSlug}`)}
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

              {/* Suggested spaces - mini cards matching Recent Spaces style */}
              {propertyId && (
                <SuggestedSpacesStrip
                  suggestedSpaces={group.suggestedSpaces}
                  groupColor={group.color}
                  propertyId={propertyId}
                  onSpaceAdded={() => {
                    queryClient.invalidateQueries({ queryKey: ["spaces"] });
                  }}
                />
              )}
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
    </div>
  );
}
