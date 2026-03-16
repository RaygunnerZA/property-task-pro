import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { SpaceGroupCard } from "./SpaceGroupCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_SPACE_GROUPS } from "@/components/onboarding/onboardingSpaceGroups";

interface PropertySpacesSectionProps {
  propertyId: string;
  /** 'grid' = property page layout; 'scroller' = horizontal scroll (e.g. onboarding) */
  variant?: "grid" | "scroller";
}

export function PropertySpacesSection({ propertyId, variant = "grid" }: PropertySpacesSectionProps) {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const navigate = useNavigate();

  // Fetch space types grouped by default_ui_group
  const { data: spaceTypes = [], isLoading: spaceTypesLoading } = useQuery({
    queryKey: ["space-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_types")
        .select("id, name, default_ui_group, functional_class")
        .order("default_ui_group");

      if (error) throw error;
      return data || [];
    },
    enabled: !!supabase,
  });

  // Fetch spaces for this property to count spaces per group
  const { data: spaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces", propertyId],
    queryFn: async () => {
      if (!orgId || !propertyId) return [];
      
      const { data, error } = await supabase
        .from("spaces")
        .select("id, space_type_id, name")
        .eq("property_id", propertyId)
        .eq("org_id", orgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && !!propertyId && !!supabase,
  });

  // Count spaces per group
  const spacesByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    
    spaces.forEach((space) => {
      if (space.space_type_id) {
        const spaceType = spaceTypes.find(st => st.id === space.space_type_id);
        if (spaceType?.default_ui_group) {
          const current = counts.get(spaceType.default_ui_group) || 0;
          counts.set(spaceType.default_ui_group, current + 1);
        }
      }
    });
    
    return counts;
  }, [spaces, spaceTypes]);

  const isLoading = spaceTypesLoading || spacesLoading;

  const cards = ONBOARDING_SPACE_GROUPS.map((group) => {
    const spaceCount = spacesByGroup.get(group.label) || 0;
    return (
      <SpaceGroupCard
        key={group.id}
        groupName={group.label}
        description={group.description}
        color={group.color}
        spaceCount={spaceCount}
        propertyId={propertyId}
      />
    );
  });

  if (isLoading) {
    return (
      <div className={variant === "scroller" ? "flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className={variant === "scroller" ? "h-[260px] w-[200px] flex-shrink-0 rounded-[8px]" : "h-[240px] rounded-[8px]"} />
        ))}
      </div>
    );
  }

  if (variant === "scroller") {
    return (
      <div className="relative w-full overflow-x-hidden overflow-y-visible">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <div className="flex-shrink-0 w-[200px]">
            <div
              className="bg-card/0 rounded-[8px] overflow-hidden shadow-none transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.99] h-[228px]"
              onClick={() => navigate(`/properties/${propertyId}/plans`)}
            >
              <div className="pt-[21px] pb-0 pl-[1px] pr-[1px]">
                <div className="flex items-center justify-between gap-1 h-[92px] align-top">
                  <h3 className="font-semibold text-[31px] text-teal-500 leading-[28px] flex-1 align-middle h-[81px] pt-0">
                    Start with your building plans
                  </h3>
                </div>
                <div
                  className="-ml-2.5 -mr-2.5 pt-0 pb-0 px-1 mt-[7px]"
                  style={{
                    height: "1px",
                    backgroundImage:
                      "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
                    backgroundSize: "7px 1px",
                    backgroundRepeat: "repeat-x",
                    boxShadow: "1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)",
                  }}
                />
                <div className="space-y-1" style={{ marginTop: "3px" }}>
                  <p className="text-xs text-muted-foreground leading-[18px] pt-[6px] pb-0">
                    Upload a floor plan to quickly generate spaces, service areas and maintenance
                    zones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/properties/${propertyId}/plans`);
                  }}
                  className="mt-3 w-full h-8 rounded-[6px] bg-primary text-primary-foreground text-xs font-semibold transition-all duration-200 hover:opacity-95 active:scale-[0.99]"
                  style={{
                    boxShadow:
                      "0px 0px 0px 0px rgba(0, 0, 0, 0), inset 1px 2px 2px 0px rgba(255, 255, 255, 0.75), inset -2.4px -1.5px 2px 0px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  Upload floor plan
                </button>
              </div>
            </div>
          </div>
          {cards.map((card, i) => (
            <div key={ONBOARDING_SPACE_GROUPS[i].id} className="flex-shrink-0 w-[200px]">
              {card}
            </div>
          ))}
        </div>
        {/* Narrow slot gradient on right boundary - same as dashboard property slider */}
        <div
          className="absolute top-0 right-0 bottom-0 pointer-events-none"
          style={{
            width: "10px",
            background: "linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))",
            zIndex: 20,
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards}
    </div>
  );
}
