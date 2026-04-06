import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { PageHeader } from "@/components/design-system/PageHeader";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSpaceDetail } from "@/hooks/useSpaceDetail";
import { useSpaceComplianceQuery } from "@/hooks/useSpaceComplianceQuery";
import { useSpaceDocumentsQuery } from "@/hooks/useSpaceDocumentsQuery";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { FolderOpen, Package, Shield, FileText, Sparkles, ArrowLeft, Plus, ListChecks } from "lucide-react";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SpaceDetailPage() {
  const { propertyId, spaceId } = useParams<{ propertyId: string; spaceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    isOpen: assistantOpen,
    closeAssistant,
    openAssistant,
    assistantContext,
    messages,
    proposedAction,
    loading: assistantLoading,
    onSendMessage,
    onConfirmAction,
    onRejectAction,
  } = useAssistantContext();
  const { data: space, isLoading: spaceLoading } = useSpaceDetail(spaceId);
  const { data: compliance = [], isLoading: complianceLoading } = useSpaceComplianceQuery(spaceId);
  const { data: documents = [], isLoading: documentsLoading } = useSpaceDocumentsQuery(spaceId, propertyId);
  const { data: allAssets = [] } = useAssetsQuery(propertyId);
  const { data: tasksData = [], isLoading: tasksLoading } = useTasksQuery(propertyId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"create" | "details" | "assistant" | null>("create");

  const assetsInSpace = useMemo(() => {
    return allAssets.filter((a: any) => a.space_id === spaceId);
  }, [allAssets, spaceId]);

  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [],
      themes: typeof task.themes === "string" ? JSON.parse(task.themes) : task.themes || [],
      teams: typeof task.teams === "string" ? JSON.parse(task.teams) : task.teams || [],
    }));
  }, [tasksData]);

  const spaceTasks = useMemo(() => {
    if (!spaceId) return [];
    return tasks.filter((task: any) => {
      if (!Array.isArray(task.spaces)) return false;
      return task.spaces.some((s: any) => s?.id === spaceId);
    });
  }, [tasks, spaceId]);

  const complianceWithStatus = useMemo(
    () =>
      compliance.map((c: any) => ({
        ...c,
        expiry_status: c.expiry_state,
      })),
    [compliance]
  );

  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1380);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (assistantOpen && isLargeScreen) {
      setExpandedSection("assistant");
    }
  }, [assistantOpen, isLargeScreen]);

  useEffect(() => {
    if (expandedSection === "create") {
      setShowCreateTask(true);
    }
  }, [expandedSection]);

  if (spaceLoading) {
    return <LoadingState message="Loading space..." />;
  }

  if (!space) {
    return <EmptyState icon={FolderOpen} title="Space not found" description="This space no longer exists or is unavailable." />;
  }

  const spaceName = space.name || "Unnamed Space";
  const propertyName = space.properties?.nickname || space.properties?.address || "Property";
  const spaceProperty = {
    id: propertyId || "",
    name: propertyName,
    address: space.properties?.address || propertyName,
  };

  const headerElement = (
    <PageHeader>
      <div
        className="px-4 py-2 h-[60px] flex items-center justify-between rounded-bl-[12px]"
        style={{
          backgroundImage: "linear-gradient(to right, #8EC9CE 0%, #8EC9CE 20%, transparent 70%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-3 w-[248px] min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/properties/${propertyId}/spaces/organise`)}
            className="shrink-0 text-white hover:bg-white/20 rounded-md p-1.5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white leading-tight">{spaceName}</h1>
            <p className="text-sm text-white/85 truncate">{propertyName}</p>
          </div>
        </div>
        {spaceId && (
          <button
            onClick={() => openAssistant({ type: "space", id: spaceId, name: spaceName })}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Open Assistant"
          >
            <FillaIcon size={20} className="brightness-0 invert" />
          </button>
        )}
      </div>
    </PageHeader>
  );

  const thirdColumnContent = propertyId && spaceId ? (
    <div className="flex flex-col pt-4 pr-2 pb-0 pl-2 min-h-0">
      <ThirdColumnConcertina
        sections={[
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
                defaultSpaceIds={spaceId ? [spaceId] : []}
                variant="column"
                headless
              />
            ),
          },
          {
            id: "details",
            title: "Task Details",
            isExpanded: expandedSection === "details",
            onToggle: () => setExpandedSection((s) => (s === "details" ? null : "details")),
            children: selectedTaskId ? (
              <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} variant="column" />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a task to view details</div>
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
                showContextHeader
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
        header={headerElement}
        leftColumn={
          <div className="h-auto md:h-screen flex flex-col overflow-y-auto md:overflow-hidden w-full max-w-full pl-0">
            <div className="p-2">
              <div className="bg-card/60 rounded-[8px] shadow-e1 overflow-hidden">
                <div className="w-full aspect-[4/3] flex items-center justify-center bg-muted/50">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/70" />
                </div>
                <div className="p-4 space-y-3">
                  <h2 className="font-semibold text-lg text-foreground leading-tight">{spaceName}</h2>
                  <p className="text-xs text-muted-foreground">{propertyName}</p>
                  <dl className="grid gap-2 text-sm">
                    {space.floor_level && (
                      <div>
                        <dt className="text-muted-foreground">Floor</dt>
                        <dd>{space.floor_level}</dd>
                      </div>
                    )}
                    {space.area_sqm != null && (
                      <div>
                        <dt className="text-muted-foreground">Area</dt>
                        <dd>{space.area_sqm} m²</dd>
                      </div>
                    )}
                  </dl>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isLargeScreen) {
                          setSelectedTaskId(null);
                          setShowCreateTask(true);
                          setExpandedSection("create");
                        } else {
                          setShowCreateTask(true);
                        }
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Task
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/work/tasks?propertyId=${propertyId}`)}
                      className="w-full text-muted-foreground hover:text-foreground"
                    >
                      <ListChecks className="h-4 w-4 mr-1.5" />
                      All Tasks
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto p-[15px] space-y-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4 w-full grid grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="insights">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Insights
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="rounded-lg bg-card p-4 shadow-e1">
                  <h3 className="font-semibold text-foreground mb-2">Overview</h3>
                  <p className="text-sm text-muted-foreground">
                    {spaceName} currently has {assetsInSpace.length} asset{assetsInSpace.length !== 1 ? "s" : ""} and{" "}
                    {complianceWithStatus.length} compliance item{complianceWithStatus.length !== 1 ? "s" : ""} linked.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="mt-0">
                {assetsInSpace.length === 0 ? (
                  <EmptyState icon={Package} title="No assets" description="No assets are assigned to this space" />
                ) : (
                  <div className="space-y-2">
                    {assetsInSpace.map((asset: any) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => navigate(`/assets?assetId=${asset.id}`)}
                        className={cn(
                          "w-full p-4 rounded-lg text-left",
                          "bg-card shadow-e1 hover:shadow-e2 transition-all"
                        )}
                      >
                        <div className="font-medium">{asset.name || "Unnamed Asset"}</div>
                        {asset.asset_type && <div className="text-xs text-muted-foreground">{asset.asset_type}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="compliance" className="mt-0">
                {complianceLoading ? (
                  <LoadingState message="Loading compliance..." />
                ) : complianceWithStatus.length === 0 ? (
                  <EmptyState
                    icon={Shield}
                    title="No compliance linked"
                    description="Link compliance items to this space to see them here"
                  />
                ) : (
                  <div className="space-y-2">
                    {complianceWithStatus.map((item) => (
                      <ComplianceCard key={item.id} compliance={item} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                {documentsLoading ? (
                  <LoadingState message="Loading documents..." />
                ) : documents.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No documents"
                    description="Documents linked to this space will appear here"
                  />
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "block p-4 rounded-lg",
                          "bg-card shadow-e1 hover:shadow-e2 transition-all"
                        )}
                      >
                        <div className="font-medium">{doc.title || doc.file_name || "Document"}</div>
                        {doc.document_type && <div className="text-xs text-muted-foreground">{doc.document_type}</div>}
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="insights" className="mt-0">
                {spaceId && <GraphInsightPanel start={{ type: "space", id: spaceId }} depth={3} variant="full" />}
              </TabsContent>
            </Tabs>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Space Tasks</h2>
              <TaskList
                tasks={spaceTasks}
                properties={[spaceProperty]}
                tasksLoading={tasksLoading}
                onTaskClick={(taskId) => {
                  setSelectedTaskId(taskId);
                  if (isLargeScreen) {
                    setExpandedSection("details");
                  }
                }}
                selectedTaskId={selectedTaskId || undefined}
              />
            </div>
          </div>
        }
        thirdColumn={thirdColumnContent}
      />

      {showCreateTask && !isLargeScreen && (
        <CreateTaskModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          onTaskCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", undefined, propertyId] });
          }}
          defaultPropertyId={propertyId}
          defaultSpaceIds={spaceId ? [spaceId] : []}
          variant="modal"
        />
      )}

      {selectedTaskId && !isLargeScreen && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} variant="modal" />
      )}
    </div>
  );
}
