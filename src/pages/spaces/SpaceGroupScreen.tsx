import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { propertyHubPath } from "@/lib/propertyRoutes";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { SpaceGroupIdentityCard } from "@/components/spaces/SpaceGroupIdentityCard";
import { SpaceGroupMiniCardsStrip } from "@/components/spaces/SpaceGroupMiniCardsStrip";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { SuggestedSpacesStrip } from "@/components/spaces/SuggestedSpacesStrip";
import { getSpaceGroupById } from "@/components/onboarding/onboardingSpaceGroups";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";
import { WorkspaceScopeStrip } from "@/components/property-workspace";
import { LoadingState } from "@/components/design-system/LoadingState";
import { toast } from "sonner";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";
import { FILLA_TURQUOISE } from "@/lib/brandColors";

/**
 * Space Group Screen - Template for all space groups (Circulation, Service Areas, etc.)
 * Same layout as Property Detail: 265px left, 700px middle, third column concertina on wide screens.
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

  const [selectedSpaceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"add-space" | "create" | "details" | "assistant" | null>("add-space");

  const { isOpen: assistantOpen, closeAssistant, assistantContext, messages, proposedAction, loading: assistantLoading, onSendMessage, onConfirmAction, onRejectAction } = useAssistantContext();

  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= LAYOUT_BREAKPOINTS.layout);
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

  const header = (
    <>
      <GlobalAppHeader accentColor={group.color || FILLA_TURQUOISE} />
      {propertyId && groupSlug && (
        <WorkspaceScopeStrip>
          <PropertyPageScopeBar
            propertyId={propertyId}
            hrefForProperty={(pid) => `/properties/${pid}/spaces/organise/${groupSlug}`}
            backHref={`/properties/${propertyId}/spaces/organise`}
          />
        </WorkspaceScopeStrip>
      )}
    </>
  );

  const thirdColumnContent = propertyId && groupSlug ? (
    <div className="flex min-w-0 max-w-full flex-col pt-3 pr-1 pb-0 pl-1 min-h-0">
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
            variant: "static",
            children: (
              <IntakeModal
                open
                onOpenChange={() => undefined}
                onTaskCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["tasks", undefined, propertyId] });
                }}
                defaultPropertyId={propertyId}
                variant="column"
                headless
                initialIntakeMode="report_issue"
              />
            ),
          },
          ...(selectedTaskId
            ? [
                {
                  id: "details" as const,
                  title: "Task Details",
                  variant: "static" as const,
                  children: (
                    <TaskDetailPanel
                      taskId={selectedTaskId}
                      onClose={() => setSelectedTaskId(null)}
                      variant="column"
                      onOpenTask={setSelectedTaskId}
                    />
                  ),
                },
              ]
            : []),
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
    <div className="dashboard-workbench property-workbench-scope-header min-h-screen w-full max-w-full overflow-x-hidden bg-background">
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
              onSeeTasks={() =>
                navigate(propertyHubPath(propertyId, { group: groupSlug }))
              }
            />
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto">
            <div className="px-gutter-page pt-gutter-page">
              <PageContentTitle
                title={group.label}
                subtitle={property?.nickname || property?.address || "Add spaces"}
              />
            </div>
            {propertyId && groupSlug && group?.color && (
              <div className="px-gutter-page">
                <SpaceGroupMiniCardsStrip
                  propertyId={propertyId}
                  groupSlug={groupSlug}
                  groupColor={group.color}
                  tasks={tasks}
                  onSpaceClick={(spaceId) => navigate(`/properties/${propertyId}/spaces/${spaceId}`)}
                  selectedSpaceId={selectedSpaceId}
                />
              </div>
            )}

            <div className="p-gutter-page space-y-6">
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
                  onSpaceOpen={(spaceId) => navigate(`/properties/${propertyId}/spaces/${spaceId}`)}
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
        <IntakeModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          onTaskCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", undefined, propertyId] });
          }}
          defaultPropertyId={propertyId}
          variant="modal"
          initialIntakeMode="report_issue"
        />
      )}
    </div>
  );
}
