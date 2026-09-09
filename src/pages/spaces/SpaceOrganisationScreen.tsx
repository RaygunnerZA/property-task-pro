import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { propertySubPath } from "@/lib/propertyRoutes";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { PropertySpaceGroupCarousel } from "@/components/spaces/PropertySpaceGroupCarousel";
import { AllSpacesDirectory } from "@/components/spaces/AllSpacesDirectory";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { Button } from "@/components/ui/button";
import { FileUp, LayoutGrid, Plus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
  WorkspaceSectionHeading,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import { workbenchAskPlaceholder } from "@/components/workbench/WorkbenchCentreSearch";
import { FILLA_TURQUOISE } from "@/lib/brandColors";

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
  const [spaceSearchQuery, setSpaceSearchQuery] = useState("");

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

  const openTaskCountsBySpaceId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === "completed" || t.status === "archived") continue;
      for (const s of t.spaces || []) {
        if (!s?.id) continue;
        counts[s.id] = (counts[s.id] || 0) + 1;
      }
    }
    return counts;
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
  const issuesRequested =
    searchParams.get("workTab") === "issues" || urgentOnly;

  const spacesForIssuesList = useMemo(() => {
    const q = spaceSearchQuery.trim().toLowerCase();
    return spaces.filter((s) => {
      if (!openTaskSpaceIds.has(s.id)) return false;
      if (urgentOnly && !urgentPrioritySpaceIds.has(s.id)) return false;
      if (q && !(s.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [spaces, openTaskSpaceIds, urgentPrioritySpaceIds, urgentOnly, spaceSearchQuery]);

  const spacesWithIssuesCount = useMemo(
    () => spaces.filter((s) => openTaskSpaceIds.has(s.id)).length,
    [spaces, openTaskSpaceIds]
  );

  /** Operational chrome only when a space actually needs work (or a deep link asks for it). */
  const showOperationalView = spacesWithIssuesCount > 0 || issuesRequested;

  useEffect(() => {
    if (issuesRequested) {
      setWorkTab("issues");
      return;
    }
    if (spacesWithIssuesCount === 0) {
      setWorkTab("groups");
    }
  }, [issuesRequested, spacesWithIssuesCount]);

  const headerAccent =
    (property as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() ||
    FILLA_TURQUOISE;

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  const header = (
    <GlobalAppHeader accentColor={headerAccent} hideSearch variant="activity" />
  );

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard title="Overview" description="How this property is organised">
        <ul className="text-xs text-muted-foreground space-y-2">
          <li>
            <span className="font-semibold text-foreground">{spaces.length}</span> spaces
          </li>
          <li>
            <span className="font-semibold text-foreground">{spacesWithIssuesCount}</span> with open
            tasks
          </li>
          <li className="text-2xs pt-1">
            Groups: Circulation, Habitable / Working, Service — use the work column to open each.
          </li>
        </ul>
      </WorkspaceSurfaceCard>
      <div className="flex flex-col overflow-hidden rounded-xl bg-card/60 shadow-e1">
        <PropertySpacesList
          propertyId={propertyId}
          tasks={tasks}
          onSpaceClick={setSelectedSpaceId}
          selectedSpaceId={selectedSpaceId}
          defaultView="list"
        />
      </div>
      <WorkspaceSurfaceCard
        className="hover:shadow-e1"
        title="Floor plans"
        titleAccessory={
          <img
            src="/spaces/floor-plan-icon.png"
            alt=""
            width={32}
            height={32}
            decoding="async"
            className="h-8 w-8 shrink-0 object-contain"
          />
        }
        description="Upload a sheet, confirm building and floor, then review proposed Spaces before creating any."
      >
        <Button
          type="button"
          className="w-full btn-accent-vibrant gap-2"
          onClick={() => navigate(propertySubPath(propertyId, "plans"))}
        >
          <FileUp className="h-4 w-4" />
          Open building setup
        </Button>
      </WorkspaceSurfaceCard>
    </div>
  );

  const workColumn = (
    <div className="space-y-5">
      {showOperationalView ? (
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
      ) : null}

      {showOperationalView && workTab === "issues" ? (
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
                {spaceSearchQuery.trim()
                  ? "No spaces match your search."
                  : urgentOnly
                    ? "No spaces with urgent-priority open tasks."
                    : "No spaces with open tasks."}
              </p>
            )}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <PropertySpaceGroupCarousel propertyId={propertyId} spaceFilter={spaceSearchQuery} />
          <div className="border-t border-border/30 pt-5">
            <AllSpacesDirectory
              propertyId={propertyId}
              spaceFilter={spaceSearchQuery}
              openTaskSpaceIds={openTaskSpaceIds}
              openTaskCountsBySpaceId={openTaskCountsBySpaceId}
            />
          </div>
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
    <PropertyWorkspaceLayout
      pageTitle="Spaces"
      pageSubtitle={
        property
          ? `${property.nickname || property.address}`
          : "Organise your spaces"
      }
      pageIcon={<LayoutGrid />}
      searchPlaceholder={workbenchAskPlaceholder("Spaces")}
      searchValue={spaceSearchQuery}
      onSearchChange={setSpaceSearchQuery}
      searchAccentColor={headerAccent}
      contextColumn={contextColumn}
      workColumn={workColumn}
      actionColumn={actionColumn}
    />
  );

  return (
    <div className="dashboard-workbench min-h-screen w-full max-w-full overflow-x-hidden bg-background">
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
