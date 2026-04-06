import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { propertyHubPath, propertySubPath } from "@/lib/propertyRoutes";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { SpaceGroupLinkCard } from "@/components/spaces/SpaceGroupLinkCard";
import { ONBOARDING_SPACE_GROUPS } from "@/components/onboarding/onboardingSpaceGroups";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { Layers, FileUp, Sparkles } from "lucide-react";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";
import { LoadingState } from "@/components/design-system/LoadingState";
import {
  PropertyWorkspaceLayout,
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
  const { property, loading: propertyLoading } = useProperty(propertyId);
  const { spaces } = useSpaces(propertyId);
  const { data: tasksData = [] } = useTasksQuery(propertyId);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [workTab, setWorkTab] = useState<SpacesWorkTab>("groups");

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
      <div className="w-full border-b border-border/20 bg-background/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1480px] justify-start px-4 py-2">
          <PropertyPageScopeBar
            propertyId={propertyId}
            hrefForProperty={(pid) => propertySubPath(pid, "spaces-organise")}
            onBack={() => navigate(propertyHubPath(propertyId))}
          />
        </div>
      </div>
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
          <p className="text-sm text-muted-foreground">Select a group to add and organise spaces.</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hz-teal">
            {ONBOARDING_SPACE_GROUPS.map((group) => (
              <SpaceGroupLinkCard
                key={group.id}
                group={group}
                to={`/properties/${propertyId}/spaces/organise/${group.id}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Spaces linked to at least one open task — open a space to work it in detail.
          </p>
          <ul className="space-y-2">
            {spaces
              .filter((s) => openTaskSpaceIds.has(s.id))
              .map((s) => (
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
            {spacesWithIssuesCount === 0 && (
              <p className="text-sm text-muted-foreground py-6">No spaces with open tasks.</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  const actionColumn = (
    <div className="space-y-4">
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
      <WorkspaceSurfaceCard title="Manual add" description="Add a space when you already know the layout.">
        <p className="text-xs text-muted-foreground flex gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
          Pick a group first — you’ll add spaces inside that flow.
        </p>
        <Button variant="outline" className="w-full btn-neomorphic" asChild>
          <Link
            to={`/properties/${propertyId}/spaces/organise/${ONBOARDING_SPACE_GROUPS[0]?.id ?? "circulation"}`}
          >
            Start in first group
          </Link>
        </Button>
      </WorkspaceSurfaceCard>
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
      <div className="mx-auto max-w-[1480px] px-4 py-6 w-full">{workspace}</div>
    </div>
  );
}
