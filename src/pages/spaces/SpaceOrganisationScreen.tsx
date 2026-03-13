import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { SpaceGroupLinkCard } from "@/components/spaces/SpaceGroupLinkCard";
import { ONBOARDING_SPACE_GROUPS } from "@/components/onboarding/onboardingSpaceGroups";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Layers } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";

/**
 * Space Organisation Screen - Hub for space groups.
 * Each card links to its group screen (Circulation, Service Areas, etc.).
 * Same layout: 265px left (recent spaces), 660px right (group cards as links).
 */
export default function SpaceOrganisationScreen() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { property, loading: propertyLoading } = useProperty(propertyId);
  const { data: tasksData = [] } = useTasksQuery(propertyId);

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

  if (propertyLoading || !propertyId) {
    return <LoadingState />;
  }

  const header = (
    <PageHeader>
      <div className="px-4 pt-[63px] pb-[18px] h-[100px] flex items-center justify-between rounded-bl-[12px] bg-primary/10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/properties/${propertyId}`)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground leading-tight">
              Space Organisation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {property
                ? `${property.nickname || property.address}`
                : "Organise your spaces"}
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
            <PropertySpacesList
              propertyId={propertyId}
              tasks={tasks}
              onSpaceClick={setSelectedSpaceId}
              selectedSpaceId={selectedSpaceId}
            />
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto">
            <div className="p-[15px] space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div
                    className="p-2.5 rounded-xl"
                    style={{
                      backgroundColor: "#8EC9CE",
                      boxShadow:
                        "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
                    }}
                  >
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Space Groups
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a group to add and organise spaces.
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {ONBOARDING_SPACE_GROUPS.map((group) => (
                    <SpaceGroupLinkCard
                      key={group.id}
                      group={group}
                      to={`/properties/${propertyId}/spaces/organise/${group.id}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
