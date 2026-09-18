import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { propertySubPath, propertyActivitySpacesPath } from "@/lib/propertyRoutes";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import {
  PropertySpaceGroupCarousel,
  type SpacesOrganiseView,
} from "@/components/spaces/PropertySpaceGroupCarousel";
import { SpaceDetailPanel } from "@/components/spaces/SpaceDetailPanel";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { ManageTagsPanel } from "@/components/property/ManageTagsPanel";
import { Button } from "@/components/ui/button";
import { Building2, FileUp, Plus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
  WorkspaceTabList,
  WorkspaceTabTrigger,
  WorkspaceHealthGrid,
} from "@/components/property-workspace";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import {
  WorkbenchControlsProvider,
  useWorkbenchControls,
} from "@/contexts/WorkbenchControlsContext";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

const SPACES_ILLUSTRATION = "/centre-workbench/spaces.png";
const WORKSPACE_WIDE_MQ = `(min-width: ${LAYOUT_BREAKPOINTS.layout}px)`;

function useWorkspaceWide() {
  const [wide, setWide] = useState(
    () => (typeof window !== "undefined" ? window.matchMedia(WORKSPACE_WIDE_MQ).matches : false)
  );
  useEffect(() => {
    const mq = window.matchMedia(WORKSPACE_WIDE_MQ);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

type CreatePanelTab = "space" | "property";

/**
 * Property-scoped Spaces workspace — shared 3-column shell with Documents / Assets / Compliance.
 * Resolves property from route params (`/properties/:id/spaces/organise`) or `?property=`.
 */
function SpaceOrganisationScreenInner() {
  const { id: paramPropertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const propertyId = paramPropertyId || searchParams.get("property") || undefined;
  const { property, loading: propertyLoading } = useProperty(propertyId);
  const { spaces } = useSpaces(propertyId);
  const { data: tasksData = [] } = useTasksQuery(propertyId);
  const { searchQuery: spaceSearchQuery } = useWorkbenchControls();
  const isWide = useWorkspaceWide();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [organiseView, setOrganiseView] = useState<SpacesOrganiseView>("category");
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [createPanelTab, setCreatePanelTab] = useState<CreatePanelTab>("space");

  const spaceIdFromUrl = searchParams.get("spaceId")?.trim() || null;

  useEffect(() => {
    if (spaceIdFromUrl) {
      setSelectedSpaceId(spaceIdFromUrl);
    }
  }, [spaceIdFromUrl]);

  const openSpace = useCallback(
    (spaceId: string | null) => {
      setSelectedSpaceId(spaceId);
      const next = new URLSearchParams(searchParams);
      if (spaceId) {
        next.set("spaceId", spaceId);
      } else {
        next.delete("spaceId");
      }
      const qs = next.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
    },
    [navigate, location.pathname, searchParams]
  );

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
  const issuesRequested =
    searchParams.get("workTab") === "issues" || urgentOnly;

  const spacesWithIssuesCount = useMemo(
    () => spaces.filter((s) => openTaskSpaceIds.has(s.id)).length,
    [spaces, openTaskSpaceIds]
  );

  const clearSpacesCount = Math.max(0, spaces.length - spacesWithIssuesCount);

  const spacesHealthStats = useMemo(() => {
    const urgentWithIssues = spaces.filter(
      (s) => openTaskSpaceIds.has(s.id) && urgentPrioritySpaceIds.has(s.id)
    ).length;
    return [
      {
        line1: "total",
        line2: "spaces",
        value: spaces.length,
        secondaryCount: spacesWithIssuesCount,
        secondaryLabel: "OPEN",
        secondaryTone: (spacesWithIssuesCount > 0 ? "urgent" : "neutral") as "urgent" | "warning" | "neutral",
        onClick: () => setOrganiseView("category"),
        selected: organiseView === "category",
      },
      {
        line1: "with",
        line2: "issues",
        value: spacesWithIssuesCount,
        secondaryCount: urgentWithIssues,
        secondaryLabel: "HOT",
        secondaryTone: (urgentWithIssues > 0 ? "urgent" : "neutral") as "urgent" | "warning" | "neutral",
        onClick: spacesWithIssuesCount > 0 ? () => setOrganiseView("attention") : undefined,
        selected: organiseView === "attention",
      },
      {
        line1: "clear",
        line2: "spaces",
        value: clearSpacesCount,
        secondaryCount: spacesWithIssuesCount,
        secondaryLabel: "WATCH",
        secondaryTone: (spacesWithIssuesCount > 0 ? "warning" : "neutral") as "urgent" | "warning" | "neutral",
        onClick: () => setOrganiseView("areas"),
      },
    ];
  }, [
    spaces,
    openTaskSpaceIds,
    urgentPrioritySpaceIds,
    spacesWithIssuesCount,
    clearSpacesCount,
    organiseView,
  ]);

  useEffect(() => {
    if (issuesRequested) setOrganiseView("attention");
  }, [issuesRequested]);

  const headerAccent =
    (property as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() ||
    FILLA_TURQUOISE;

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  const header = <GlobalAppHeader accentColor={headerAccent} />;

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceHealthGrid stats={spacesHealthStats} ariaLabel="Spaces health" />
      <div className="perforation-section pointer-events-none" aria-hidden />
      <PropertySpacesList
        propertyId={propertyId}
        tasks={tasks}
        onSpaceClick={openSpace}
        selectedSpaceId={selectedSpaceId}
      />
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
      <PropertySpaceGroupCarousel
        propertyId={propertyId}
        spaceFilter={spaceSearchQuery}
        onViewSpace={openSpace}
        tasks={tasks}
        view={organiseView}
        onViewChange={setOrganiseView}
      />
    </div>
  );

  const invalidateSpaces = () => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    queryClient.invalidateQueries({ queryKey: ["spaces-with-types"] });
  };

  const createColumn = (
    <div className="space-y-4">
      <div className="hidden layout:block">
        <WorkspaceSurfaceCard
          title={createPanelTab === "space" ? "Create space" : "Add property"}
          description={
            createPanelTab === "space"
              ? "Add a space when you already know the name and type."
              : "Add another property to this organisation."
          }
        >
          <WorkspaceTabList className="mb-3">
            <WorkspaceTabTrigger
              selected={createPanelTab === "space"}
              onClick={() => setCreatePanelTab("space")}
            >
              Create Space
            </WorkspaceTabTrigger>
            <WorkspaceTabTrigger
              selected={createPanelTab === "property"}
              onClick={() => setCreatePanelTab("property")}
            >
              Add Property
            </WorkspaceTabTrigger>
          </WorkspaceTabList>
          {createPanelTab === "space" ? (
            <AddSpaceDialog
              open
              onOpenChange={() => {}}
              properties={property ? [property] : []}
              propertyId={propertyId}
              variant="column"
              headless
              onCreated={invalidateSpaces}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create a permanent property for this organisation. You can organise its spaces next.
              </p>
              <Button
                type="button"
                className="w-full btn-accent-vibrant gap-2"
                onClick={() => setShowAddProperty(true)}
              >
                <Building2 className="h-4 w-4" />
                Add property
              </Button>
            </div>
          )}
        </WorkspaceSurfaceCard>
      </div>
      <div className="layout:hidden">
        <WorkspaceSurfaceCard
          title="Create space"
          description="Add a space when you already know the name and type."
        >
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full btn-neomorphic gap-2"
              onClick={() => setShowAddSpace(true)}
            >
              <Plus className="h-4 w-4" />
              Add space
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full btn-neomorphic gap-2"
              onClick={() => setShowAddProperty(true)}
            >
              <Building2 className="h-4 w-4" />
              Add property
            </Button>
          </div>
        </WorkspaceSurfaceCard>
      </div>
      <ManageTagsPanel surface="spaces" />
    </div>
  );

  const actionColumn =
    selectedSpaceId && isWide ? (
      <SpaceDetailPanel
        spaceId={selectedSpaceId}
        propertyId={propertyId}
        onClose={() => openSpace(null)}
        variant="column"
      />
    ) : (
      createColumn
    );

  const workspace = (
    <PropertyWorkspaceLayout
      pageTitle="Spaces"
      pageSubtitle="Areas, rooms, and groups — drag spaces into floors and zones."
      pageIllustrationSrc={SPACES_ILLUSTRATION}
      contextColumn={contextColumn}
      workColumn={workColumn}
      actionColumn={actionColumn}
    />
  );

  return (
    <div className="dashboard-workbench min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {header}
      <div className="w-full pt-[20px]">{workspace}</div>
      {selectedSpaceId && !isWide ? (
        <SpaceDetailPanel
          spaceId={selectedSpaceId}
          propertyId={propertyId}
          onClose={() => openSpace(null)}
          variant="modal"
        />
      ) : null}
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
      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
        onCreated={(created) => {
          setShowAddProperty(false);
          navigate(propertyActivitySpacesPath(created.id));
        }}
      />
    </div>
  );
}

export default function SpaceOrganisationScreen() {
  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
      <SpaceOrganisationScreenInner />
    </WorkbenchControlsProvider>
  );
}
