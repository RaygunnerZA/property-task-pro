import { useMemo } from "react";
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
