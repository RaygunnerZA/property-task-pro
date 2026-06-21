import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { propertySubPath } from "@/lib/propertyRoutes";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { PropertySpaceGroupCarousel } from "@/components/spaces/PropertySpaceGroupCarousel";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { Layers, FileUp, Plus } from "lucide-react";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";
import { LoadingState } from "@/components/design-system/LoadingState";
import {
  PropertyWorkspaceLayout,
  WorkspaceScopeStrip,
  WorkspaceSurfaceCard,
  WorkspaceSectionHeading,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";

type SpacesWorkTab = "groups" | "issues";

/**
 * Property-scoped Spaces workspace — shared 3-column shell with Documents / Assets / Compliance.
 */
export default function SpaceOrganisationScreen() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { property, loading: propertyLoading } = useProperty(propertyId);
  const { spaces } = useSpaces(propertyId);
  const { data: tasksData = [] } = useTasksQuery(propertyId);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [workTab, setWorkTab] = useState<SpacesWorkTab>("groups");
  const [showAddSpace, setShowAddSpace] = useState(false);

  useEffect(() => {
    if (searchParams.get("workTab") === "issues" || searchParams.get("urgent") === "1") {
      setWorkTab("issues");
    }
  }, [searchParams]);

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

  const openTaskSpaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      if (t.status === "completed" || t.status === "archived") continue;
      for (const s of t.spaces || []) {
        if (s?.id) ids.add(s.id);
      }
    }
    return ids;
  }, [tasks]);

  /** Spaces linked to at least one non-done task with urgent/high priority (matches property hub tile). */
  const urgentPrioritySpaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      if (t.status === "completed" || t.status === "archived") continue;
      const pr = String(t.priority ?? "").toLowerCase();
      if (pr !== "urgent" && pr !== "high") continue;
      for (const s of t.spaces || []) {
        if (s?.id) ids.add(s.id);
      }
    }
    return ids;
  }, [tasks]);

  const urgentOnly = searchParams.get("urgent") === "1";

  const spacesForIssuesList = useMemo(() => {
    return spaces.filter((s) => {
      if (!openTaskSpaceIds.has(s.id)) return false;
      if (urgentOnly && !urgentPrioritySpaceIds.has(s.id)) return false;
      return true;
    });
  }, [spaces, openTaskSpaceIds, urgentPrioritySpaceIds, urgentOnly]);

  const spacesWithIssuesCount = useMemo(
    () => spaces.filter((s) => openTaskSpaceIds.has(s.id)).length,
    [spaces, openTaskSpaceIds]
  );

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  const headerAccent =
    (property as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() || "#8EC9CE";

  const header = (
    <>
      <PageHeader>
        <div
          className="flex h-[60px] items-center rounded-bl-[12px] px-4 pr-20 py-2"
          style={{
            backgroundImage: `linear-gradient(90deg, ${headerAccent} 0%, ${headerAccent} 28%, transparent 97%, transparent 100%)`,
          }}
        >
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight text-white">Spaces</h1>
            <p className="mt-1 text-sm text-white/85">
              {property ? `${property.nickname || property.address}` : "Organise your spaces"}
            </p>
          </div>
        </div>
      </PageHeader>
      <WorkspaceScopeStrip>
        <PropertyPageScopeBar
          propertyId={propertyId}
          hrefForProperty={(pid) => propertySubPath(pid, "spaces-organise")}
        />
      </WorkspaceScopeStrip>
    </>
  );

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard title="Context" description="How this property is organised">
        <ul className="text-xs text-muted-foreground space-y-2">
          <li>
            <span className="font-semibold text-foreground">{spaces.length}</span> spaces
          </li>
          <li>
            <span className="font-semibold text-foreground">{spacesWithIssuesCount}</span> with open
            tasks
          </li>
          <li className="text-[10px] pt-1">
            Groups: Circulation, Habitable / Working, Service — use the work column to open each.
          </li>
        </ul>
      </WorkspaceSurfaceCard>
      <div className="rounded-[12px] bg-card/60 shadow-e1 overflow-hidden min-h-[200px] max-h-[420px] flex flex-col">
        <div className="px-3 py-2 border-b border-border/40">
          <p className="text-xs font-medium text-muted-foreground">Recent & navigation</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-1">
          <PropertySpacesList
            propertyId={propertyId}
            tasks={tasks}
            onSpaceClick={setSelectedSpaceId}
            selectedSpaceId={selectedSpaceId}
          />
        </div>
      </div>
      <WorkspaceSurfaceCard
        title="Floor plans & detection"
        description="Upload a plan — Filla suggests spaces without process theatre. Review and add in one pass."
      >
        <Button className="w-full btn-accent-vibrant gap-2" asChild>
          <Link to={`/properties/${propertyId}/plans`}>
            <FileUp className="h-4 w-4" />
            Open building plans
          </Link>
        </Button>
      </WorkspaceSurfaceCard>
    </div>
  );

  const workColumn = (
    <div className="space-y-5">
      <div>
        <WorkspaceSectionHeading>Operational view</WorkspaceSectionHeading>
        <WorkspaceTabList>
          <WorkspaceTabTrigger selected={workTab === "groups"} onClick={() => setWorkTab("groups")}>
            By group
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={workTab === "issues"} onClick={() => setWorkTab("issues")}>
            With issues ({spacesWithIssuesCount})
          </WorkspaceTabTrigger>
        </WorkspaceTabList>
      </div>

      {workTab === "groups" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: "#8EC9CE",
                boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
              }}
            >
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Space groups</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Hover a group to browse suggestions, add spaces, or manage what you already have.
          </p>
          <PropertySpaceGroupCarousel propertyId={propertyId} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {urgentOnly
              ? "Spaces linked to at least one urgent or high-priority open task."
              : "Spaces linked to at least one open task — open a space to work it in detail."}
          </p>
          <ul className="space-y-2">
            {spacesForIssuesList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/properties/${propertyId}/spaces/${s.id}`)}
                  className="w-full text-left rounded-lg px-3 py-2.5 bg-card/80 shadow-e1 text-sm font-medium hover:shadow-md transition-shadow"
                >
                  {s.name}
                </button>
              </li>
            ))}
            {spacesForIssuesList.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">
                {urgentOnly ? "No spaces with urgent-priority open tasks." : "No spaces with open tasks."}
              </p>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  const invalidateSpaces = () => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    queryClient.invalidateQueries({ queryKey: ["spaces-with-types"] });
  };

  const actionColumn = (
    <div className="space-y-4">
      <div className="hidden workspace:block">
        <WorkspaceSurfaceCard
          title="Create space"
          description="Add a space when you already know the name and type."
        >
          <AddSpaceDialog
            open
            onOpenChange={() => {}}
            properties={property ? [property] : []}
            propertyId={propertyId}
            variant="column"
            headless
            onCreated={invalidateSpaces}
          />
        </WorkspaceSurfaceCard>
      </div>
      <div className="workspace:hidden">
        <WorkspaceSurfaceCard
          title="Create space"
          description="Add a space when you already know the name and type."
        >
          <Button
            type="button"
            variant="outline"
            className="w-full btn-neomorphic gap-2"
            onClick={() => setShowAddSpace(true)}
          >
            <Plus className="h-4 w-4" />
            Add space
          </Button>
        </WorkspaceSurfaceCard>
      </div>
    </div>
  );

  const workspace = (
    <>
      <div className="hidden workspace:block">
        <PropertyWorkspaceLayout
          contextColumn={contextColumn}
          workColumn={workColumn}
          actionColumn={actionColumn}
        />
      </div>
      <div className="workspace:hidden flex flex-col gap-6">
        {actionColumn}
        {workColumn}
        {contextColumn}
      </div>
    </>
  );

  return (
    <div className="property-workbench-scope-header min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {header}
      <div className="mx-auto max-w-[1480px] px-gutter-page py-6 w-full">{workspace}</div>
      {showAddSpace && (
        <AddSpaceDialog
          open={showAddSpace}
          onOpenChange={setShowAddSpace}
          properties={property ? [property] : []}
          propertyId={propertyId}
          onCreated={() => {
            invalidateSpaces();
            setShowAddSpace(false);
          }}
        />
      )}
    </div>
  );
}
